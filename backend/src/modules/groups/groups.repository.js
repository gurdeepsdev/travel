import Database from "../../database/database-manager.js";

class GroupsRepository {
  async findAccessibleGroup({ groupId, itineraryId, userId }) {
    const { rows } = await Database.query(`
      SELECT g.*,
        CASE WHEN g.owner_id=$2::uuid THEN 'OWNER' ELSE m.role END AS viewer_role
      FROM groups.groups g
      LEFT JOIN groups.group_members m ON m.group_id=g.id
        AND m.user_id=$2::uuid AND m.status='ACTIVE'
      WHERE (g.id=$1::uuid OR ($1::uuid IS NULL AND g.itinerary_id=$3::uuid))
        AND g.status='ACTIVE' AND g.deleted_at IS NULL
        AND (g.owner_id=$2::uuid OR m.id IS NOT NULL)
        AND (g.itinerary_id IS NULL OR EXISTS (
          SELECT 1 FROM itinerary.itineraries i WHERE i.id=g.itinerary_id AND i.deleted_at IS NULL
        ))
    `, [groupId ?? null, userId, itineraryId ?? null]);
    return rows[0] ?? null;
  }

  async listMyGroups({ userId, limit, cursor }) {
    const { rows } = await Database.query(`
      SELECT g.*, g.created_at::text AS cursor_created_at,
        CASE WHEN g.owner_id=$1::uuid THEN 'OWNER' ELSE m.role END AS viewer_role
      FROM groups.groups g
      LEFT JOIN groups.group_members m ON m.group_id=g.id
        AND m.user_id=$1::uuid AND m.status='ACTIVE'
      WHERE g.status='ACTIVE' AND g.deleted_at IS NULL
        AND (g.owner_id=$1::uuid OR m.id IS NOT NULL)
        AND (g.itinerary_id IS NULL OR EXISTS (
          SELECT 1 FROM itinerary.itineraries i
          WHERE i.id=g.itinerary_id AND i.deleted_at IS NULL
        ))
        AND ($2::timestamp IS NULL OR (g.created_at,g.id)<($2::timestamp,$3::uuid))
      ORDER BY g.created_at DESC,g.id DESC LIMIT $4
    `, [userId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1]);
    return rows;
  }

  async createStandaloneGroup({ userId, input }) {
    return Database.transaction(async (client) => {
      const group = await this.createLinked({ client, itineraryId: null, ownerId: userId,
        name: input.name, description: input.description ?? null });
      await this.ensureOwnerMember({ client, groupId: group.id, ownerId: userId });
      return group;
    });
  }

  async linkItinerary({ groupId, itineraryId, userId }) {
    return Database.transaction(async (client) => {
      // Same lock order as invitation, trip creation and itinerary-first group creation.
      await this.lockItinerary({ client, itineraryId });
      const { rows: [itinerary] } = await client.query(`
        SELECT id FROM itinerary.itineraries
        WHERE id=$1::uuid AND created_by=$2::uuid AND deleted_at IS NULL FOR UPDATE
      `, [itineraryId, userId]);
      if (!itinerary) { return null; }
      const { rows: [group] } = await client.query(`
        SELECT * FROM groups.groups WHERE id=$1::uuid AND owner_id=$2::uuid
          AND status='ACTIVE' AND deleted_at IS NULL FOR UPDATE
      `, [groupId, userId]);
      if (!group) { return null; }
      if (group.itinerary_id === itineraryId.toLowerCase()) { return { updated: false, group }; }
      if (group.itinerary_id) { return { conflict: true }; }
      // Include deleted groups: the database unique constraint also retains their links.
      const { rows: linked } = await client.query(
        'SELECT id FROM groups.groups WHERE itinerary_id=$1::uuid', [itineraryId]);
      if (linked.length) { return { conflict: true }; }
      const { rows: [updated] } = await client.query(`
        UPDATE groups.groups SET itinerary_id=$2::uuid,updated_at=CURRENT_TIMESTAMP
        WHERE id=$1::uuid RETURNING *
      `, [groupId, itineraryId]);
      await client.query(`
        INSERT INTO trip.trip_participants(trip_id,user_id,added_by)
        SELECT t.id,m.user_id,m.added_by FROM trip.trips t
        JOIN groups.group_members m ON m.group_id=$2::uuid AND m.status='ACTIVE'
        WHERE t.itinerary_id=$1::uuid
        ON CONFLICT (trip_id,user_id) DO UPDATE SET status='ACTIVE',removed_at=NULL,
          updated_at=CURRENT_TIMESTAMP
      `, [itineraryId, groupId]);
      return { updated: true, group: updated };
    });
  }

  async removeMember({ itineraryId, userId, targetUserId, leave = false }) {
    return Database.transaction(async (client) => {
      await this.lockItinerary({ client, itineraryId });
      const { rows: [group] } = await client.query(`
        SELECT g.id,g.owner_id FROM groups.groups g
        JOIN itinerary.itineraries i ON i.id=g.itinerary_id AND i.deleted_at IS NULL
        WHERE g.itinerary_id=$1::uuid AND g.status='ACTIVE' AND g.deleted_at IS NULL
          AND ($3::boolean OR g.owner_id=$2::uuid)
        FOR UPDATE OF g
      `, [itineraryId, userId, leave]);
      if (!group) { return null; }
      const target = leave ? userId : targetUserId;
      if (group.owner_id === target) { return { error: 'OWNER_REMOVAL_FORBIDDEN' }; }
      const { rows: [member] } = await client.query(`
        SELECT id,status,removed_at FROM groups.group_members
        WHERE group_id=$1::uuid AND user_id=$2::uuid FOR UPDATE
      `, [group.id, target]);
      if (!member) { return null; }
      const updated = member.status === 'ACTIVE';
      const { rows: [removed] } = await client.query(`
        UPDATE groups.group_members SET status='REMOVED',
          removed_at=COALESCE(removed_at,CURRENT_TIMESTAMP),
          removed_by=CASE WHEN status='ACTIVE' THEN $3::uuid ELSE removed_by END,
          updated_at=CASE WHEN status='ACTIVE' THEN CURRENT_TIMESTAMP ELSE updated_at END
        WHERE group_id=$1::uuid AND user_id=$2::uuid RETURNING id,removed_at
      `, [group.id, target, userId]);
      await client.query(`
        UPDATE trip.trip_participants p SET status='REMOVED',removed_at=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP FROM trip.trips t
        WHERE p.trip_id=t.id AND t.itinerary_id=$1::uuid AND p.user_id=$2::uuid
          AND p.status='ACTIVE'
      `, [itineraryId, target]);
      await client.query(`
        UPDATE groups.group_invitations SET status='CANCELLED',
          responded_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
        WHERE group_id=$1::uuid AND invited_user_id=$2::uuid AND status='PENDING'
      `, [group.id, target]);
      return { updated, groupId: group.id, itineraryId, userId: target,
        memberId: removed.id, status: 'REMOVED', removedAt: removed.removed_at };
    });
  }

  async listInvitations({ userId, limit, cursor, status }) {
    const { rows } = await Database.query(`
      SELECT invitation.*, g.itinerary_id, g.name AS group_name,
        CASE WHEN invitation.status = 'PENDING' AND invitation.expires_at <= CURRENT_TIMESTAMP
          THEN 'EXPIRED' ELSE invitation.status END AS effective_status
      FROM groups.group_invitations invitation
      JOIN groups.groups g ON g.id = invitation.group_id
        AND g.status = 'ACTIVE' AND g.deleted_at IS NULL
      JOIN itinerary.itineraries i ON i.id = g.itinerary_id AND i.deleted_at IS NULL
      WHERE invitation.invited_user_id = $1::uuid
        AND ($2::timestamp IS NULL OR (invitation.created_at, invitation.id) < ($2::timestamp, $3::uuid))
        AND ($4::text IS NULL OR (CASE WHEN invitation.status = 'PENDING'
          AND invitation.expires_at <= CURRENT_TIMESTAMP THEN 'EXPIRED' ELSE invitation.status END) = $4)
      ORDER BY invitation.created_at DESC, invitation.id DESC LIMIT $5
    `, [userId, cursor?.createdAt ?? null, cursor?.id ?? null, status ?? null, limit + 1]);
    return rows;
  }

  async respondToInvitation({ invitationId, userId, status }) {
    return Database.transaction(async (client) => {
      const { rows: [target] } = await client.query(`
        SELECT g.itinerary_id FROM groups.group_invitations invitation
        JOIN groups.groups g ON g.id = invitation.group_id
        WHERE invitation.id = $1::uuid AND invitation.invited_user_id = $2::uuid
      `, [invitationId, userId]);
      if (!target) { return null; }
      await this.lockItinerary({ client, itineraryId: target.itinerary_id });
      const { rows: [invitation] } = await client.query(`
        SELECT invitation.*, g.itinerary_id, g.owner_id,
          (invitation.expires_at <= CURRENT_TIMESTAMP) AS expired
        FROM groups.group_invitations invitation
        JOIN groups.groups g ON g.id = invitation.group_id
          AND g.status = 'ACTIVE' AND g.deleted_at IS NULL
        JOIN itinerary.itineraries i ON i.id = g.itinerary_id AND i.deleted_at IS NULL
        WHERE invitation.id = $1::uuid AND invitation.invited_user_id = $2::uuid
        FOR UPDATE OF invitation, g
      `, [invitationId, userId]);
      if (!invitation) { return null; }
      if (invitation.status === status) {
        return { updated: false, invitation };
      }
      if (invitation.status !== 'PENDING') { return { error: 'INVITATION_RESOLVED' }; }
      if (invitation.expired) {
        await client.query(`UPDATE groups.group_invitations SET status = 'EXPIRED',
          responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [invitationId]);
        return { error: 'INVITATION_EXPIRED' };
      }
      if (status === 'ACCEPTED') {
        const { rows } = await client.query(`
          SELECT c.id FROM users.connections c
          JOIN auth.users owner ON owner.id = $1::uuid AND owner.status = 'ACTIVE'
          JOIN auth.users recipient ON recipient.id = $2::uuid AND recipient.status = 'ACTIVE'
          JOIN users.profiles op ON op.user_id = owner.id AND op.deleted_at IS NULL
          JOIN users.profiles rp ON rp.user_id = recipient.id AND rp.deleted_at IS NULL
          WHERE c.user_low_id = LEAST($1::uuid,$2::uuid)
            AND c.user_high_id = GREATEST($1::uuid,$2::uuid)
            AND NOT EXISTS (SELECT 1 FROM users.blocked_users b
              WHERE (b.user_id=$1::uuid AND b.blocked_user_id=$2::uuid)
                 OR (b.user_id=$2::uuid AND b.blocked_user_id=$1::uuid))
          FOR SHARE OF c
        `, [invitation.owner_id, userId]);
        if (!rows.length) { return { error: 'CONNECTION_REQUIRED' }; }
        await client.query(`
          INSERT INTO groups.group_members(group_id,user_id,role,status,added_by)
          VALUES ($1,$2,'MEMBER','ACTIVE',$3)
          ON CONFLICT (group_id,user_id) DO UPDATE SET status='ACTIVE', removed_at=NULL,
            removed_by=NULL, added_by=EXCLUDED.added_by, joined_at=CURRENT_TIMESTAMP,
            updated_at=CURRENT_TIMESTAMP
        `, [invitation.group_id, userId, invitation.invited_by]);
        await client.query(`
          INSERT INTO trip.trip_participants(trip_id,user_id,added_by)
          SELECT id,$2::uuid,$3::uuid FROM trip.trips WHERE itinerary_id=$1::uuid
          ON CONFLICT (trip_id,user_id) DO UPDATE SET status='ACTIVE', removed_at=NULL,
            added_by=EXCLUDED.added_by, joined_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        `, [invitation.itinerary_id, userId, invitation.invited_by]);
      }
      const { rows: [resolved] } = await client.query(`
        UPDATE groups.group_invitations SET status=$2, responded_at=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *
      `, [invitationId, status]);
      return { updated: true, invitation: { ...resolved, itinerary_id: invitation.itinerary_id } };
    });
  }

  async createInvitation({ itineraryId, userId, input }) {
    return Database.transaction(async (client) => {
      await this.lockItinerary({ client, itineraryId });
      const itinerary = await this.findOwnedItinerary({ client, itineraryId, userId });
      const group = itinerary && await this.findByItineraryId({ client, itineraryId });
      if (!group || group.owner_id !== userId || group.status !== 'ACTIVE') {
        return null;
      }

      const { rows: connections } = await client.query(`
        SELECT connection.id
        FROM users.connections connection
        JOIN auth.users target ON target.id = $2::uuid
          AND target.status = 'ACTIVE'
        JOIN users.profiles profile ON profile.user_id = target.id
          AND profile.deleted_at IS NULL
        WHERE connection.user_low_id = LEAST($1::uuid, $2::uuid)
          AND connection.user_high_id = GREATEST($1::uuid, $2::uuid)
          AND NOT EXISTS (
            SELECT 1 FROM users.blocked_users blocked
            WHERE (blocked.user_id = $1::uuid AND blocked.blocked_user_id = $2::uuid)
               OR (blocked.user_id = $2::uuid AND blocked.blocked_user_id = $1::uuid)
          )
        FOR SHARE OF connection
      `, [userId, input.userId]);
      if (!connections.length) {
        return { error: 'CONNECTION_REQUIRED' };
      }

      const { rows: members } = await client.query(`
        SELECT id FROM groups.group_members
        WHERE group_id = $1::uuid AND user_id = $2::uuid AND status = 'ACTIVE'
      `, [group.id, input.userId]);
      if (members.length) {
        return { error: 'ALREADY_MEMBER' };
      }

      await client.query(`
        UPDATE groups.group_invitations
        SET status = 'EXPIRED', responded_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE group_id = $1::uuid AND invited_user_id = $2::uuid
          AND status = 'PENDING' AND expires_at <= CURRENT_TIMESTAMP
      `, [group.id, input.userId]);
      const { rows: pending } = await client.query(`
        SELECT * FROM groups.group_invitations
        WHERE group_id = $1::uuid AND invited_user_id = $2::uuid AND status = 'PENDING'
      `, [group.id, input.userId]);
      if (pending.length) {
        return { created: false, invitation: pending[0] };
      }

      const { rows } = await client.query(`
        INSERT INTO groups.group_invitations
          (group_id, invited_user_id, invited_by, message, expires_at)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, CURRENT_TIMESTAMP + INTERVAL '7 days')
        RETURNING *
      `, [group.id, input.userId, userId, input.message ?? null]);
      return { created: true, invitation: rows[0] };
    });
  }

  async lockItinerary({ client, itineraryId }) {
    await client.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtextextended($1::text, 0)
        )
      `,
      [itineraryId],
    );
  }

  async findOwnedItinerary({ client, itineraryId, userId }) {
    const { rows } = await client.query(
      `
        SELECT id, title
        FROM itinerary.itineraries
        WHERE id = $1::uuid
          AND created_by = $2::uuid
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [itineraryId, userId],
    );
    return rows[0] ?? null;
  }

  async findByItineraryId({ client, itineraryId }) {
    const { rows } = await client.query(
      `
        SELECT
          id,
          owner_id,
          itinerary_id,
          name,
          description,
          status,
          created_at,
          updated_at
        FROM groups.groups
        WHERE itinerary_id = $1::uuid
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [itineraryId],
    );
    return rows[0] ?? null;
  }

  async createLinked({ client, itineraryId, ownerId, name, description }) {
    const { rows } = await client.query(
      `
        INSERT INTO groups.groups (
          owner_id,
          itinerary_id,
          name,
          description
        )
        VALUES ($1::uuid, $2::uuid, $3, $4)
        RETURNING
          id,
          owner_id,
          itinerary_id,
          name,
          description,
          status,
          created_at,
          updated_at
      `,
      [ownerId, itineraryId, name, description],
    );
    return rows[0];
  }

  async findAccessibleLinkedGroup({ itineraryId, userId }) {
    const { rows } = await Database.query(
      `
        SELECT
          user_group.id,
          user_group.owner_id,
          user_group.itinerary_id,
          user_group.name,
          user_group.description,
          user_group.status,
          user_group.created_at,
          user_group.updated_at
        FROM groups.groups user_group
        INNER JOIN itinerary.itineraries itinerary
          ON itinerary.id = user_group.itinerary_id
          AND itinerary.deleted_at IS NULL
        WHERE user_group.itinerary_id = $1::uuid
          AND user_group.status = 'ACTIVE'
          AND user_group.deleted_at IS NULL
          AND (
            user_group.owner_id = $2::uuid
            OR EXISTS (
              SELECT 1
              FROM groups.group_members member
              WHERE member.group_id = user_group.id
                AND member.user_id = $2::uuid
                AND member.status = 'ACTIVE'
            )
          )
        LIMIT 1
      `,
      [itineraryId, userId],
    );
    return rows[0] ?? null;
  }

  async listActiveMembers({ groupId }) {
    const { rows } = await Database.query(
      `
        SELECT
          member.id,
          member.group_id,
          member.user_id,
          member.role,
          member.status,
          member.joined_at,
          member.created_at,
          member.updated_at,
          profile.username,
          profile.display_name,
          profile.is_verified,
          profile_photo.id AS profile_photo_id,
          profile_photo.storage_provider AS profile_photo_storage_provider,
          profile_photo.storage_key AS profile_photo_storage_key,
          profile_photo.is_public AS profile_photo_is_public,
          profile_photo.mime_type AS profile_photo_mime_type
        FROM groups.group_members member
        INNER JOIN users.profiles profile
          ON profile.user_id = member.user_id
          AND profile.deleted_at IS NULL
        LEFT JOIN media.assets profile_photo
          ON profile_photo.id = profile.profile_photo_asset_id
          AND profile_photo.deleted_at IS NULL
        WHERE member.group_id = $1::uuid
          AND member.status = 'ACTIVE'
        ORDER BY
          CASE member.role
            WHEN 'OWNER' THEN 1
            WHEN 'ADMIN' THEN 2
            ELSE 3
          END,
          member.joined_at ASC,
          member.id ASC
      `,
      [groupId],
    );
    return rows;
  }

  async ensureOwnerMember({ client, groupId, ownerId }) {
    await client.query(
      `
        INSERT INTO groups.group_members (
          group_id,
          user_id,
          role,
          status,
          added_by
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          'OWNER',
          'ACTIVE',
          $2::uuid
        )
        ON CONFLICT (group_id, user_id)
        DO UPDATE SET
          role = 'OWNER',
          status = 'ACTIVE',
          removed_at = NULL,
          removed_by = NULL,
          updated_at = CURRENT_TIMESTAMP
      `,
      [groupId, ownerId],
    );
  }

  async createLinkedGroup({ itineraryId, userId, input }) {
    return Database.transaction(async (client) => {
      await this.lockItinerary({ client, itineraryId });

      const itinerary = await this.findOwnedItinerary({
        client,
        itineraryId,
        userId,
      });
      if (!itinerary) {
        return null;
      }

      let group = await this.findByItineraryId({
        client,
        itineraryId,
      });
      let created = false;

      if (!group) {
        group = await this.createLinked({
          client,
          itineraryId,
          ownerId: userId,
          name: input.name ?? itinerary.title ?? "Trip group",
          description: input.description ?? null,
        });
        created = true;
      }

      if (group.owner_id !== userId) {
        return { conflict: true };
      }

      await this.ensureOwnerMember({
        client,
        groupId: group.id,
        ownerId: userId,
      });

      return { group, created };
    });
  }
}

export default new GroupsRepository();
