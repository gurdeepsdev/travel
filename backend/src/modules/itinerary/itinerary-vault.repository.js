import Database from "../../database/database-manager.js";
import { createHash } from "node:crypto";

class ItineraryVaultRepository {
  async createPrivateAsset({ client, userId, upload }) {
    // Use an upload-scoped deduplication digest; the file checksum lives on the document.
    const digest = createHash('sha256')
      .update(`vault:${upload.storageKey}:${upload.checksum}`).digest('hex');
    const { rows } = await client.query(`
      INSERT INTO media.assets(storage_provider,bucket,storage_key,original_filename,
        mime_type,extension,file_size,checksum,processing_status,uploaded_by,is_public)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$9,'READY',$8::uuid,FALSE) RETURNING *
    `, [upload.storageProvider,upload.bucket,upload.storageKey,upload.originalFilename,
      upload.mimeType,upload.extension,upload.fileSize,userId,digest]);
    return rows[0];
  }

  async findOwnedItineraryTrip({
    client = Database,
    itineraryId,
    userId,
  }) {
    const { rows } = await client.query(
      `
        SELECT
          itinerary.id AS itinerary_id,
          trip_record.id AS trip_id
        FROM itinerary.itineraries itinerary
        LEFT JOIN trip.trips trip_record
          ON trip_record.itinerary_id = itinerary.id
          AND trip_record.user_id = $2::uuid
        WHERE itinerary.id = $1::uuid
          AND itinerary.created_by = $2::uuid
          AND itinerary.deleted_at IS NULL
        LIMIT 1
      `,
      [itineraryId, userId],
    );
    return rows[0] ?? null;
  }

  async create({
    client,
    tripId,
    userId,
    assetId,
    input,
    checksum = null,
  }) {
    const { rows } = await client.query(
      `
        INSERT INTO trip.trip_documents (
          trip_id, owner_id, document_type,
          title, asset_id, document_number,
          issue_date, expiry_date,
          issuing_country_id, visibility,
          notes, metadata
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4,
          $5::uuid, $6, $7::date, $8::date,
          $9::uuid, 'PRIVATE', $10, $11::jsonb
        )
        RETURNING *
      `,
      [
        tripId,
        userId,
        input.documentType,
        input.title,
        assetId,
        input.documentNumber ?? null,
        input.issueDate ?? null,
        input.expiryDate ?? null,
        input.issuingCountryId ?? null,
        input.notes ?? null,
        JSON.stringify(checksum ? { checksum } : {}),
      ],
    );
    return rows[0];
  }

  async listOwned({
    itineraryId,
    userId,
    documentType = null,
  }) {
    const { rows } = await Database.query(
      `
        SELECT
          document.*,
          itinerary.id AS itinerary_id,
          asset.original_filename,
          asset.mime_type,
          asset.extension,
          asset.file_size
        FROM trip.trip_documents document
        INNER JOIN trip.trips trip_record
          ON trip_record.id = document.trip_id
        INNER JOIN itinerary.itineraries itinerary
          ON itinerary.id = trip_record.itinerary_id
        INNER JOIN media.assets asset
          ON asset.id = document.asset_id
          AND asset.deleted_at IS NULL
        WHERE itinerary.id = $1::uuid
          AND itinerary.created_by = $2::uuid
          AND itinerary.deleted_at IS NULL
          AND document.owner_id = $2::uuid
          AND document.deleted_at IS NULL
          AND (
            $3::varchar IS NULL OR
            document.document_type = $3
          )
        ORDER BY document.created_at DESC,
          document.id DESC
      `,
      [itineraryId, userId, documentType],
    );
    return rows;
  }

  async findAccessibleItineraryTrip({
    client = Database,
    itineraryId,
    userId,
  }) {
    const { rows } = await client.query(
      `
        SELECT itinerary.id AS itinerary_id,
          trip_record.id AS trip_id,
          itinerary.created_by AS owner_id
        FROM itinerary.itineraries itinerary
        LEFT JOIN trip.trips trip_record
          ON trip_record.itinerary_id = itinerary.id
        WHERE itinerary.id = $1::uuid
          AND itinerary.deleted_at IS NULL
          AND (
            itinerary.created_by = $2::uuid
            OR EXISTS (
              SELECT 1
              FROM groups.groups user_group
              INNER JOIN groups.group_members member
                ON member.group_id = user_group.id
                AND member.status = 'ACTIVE'
              WHERE user_group.itinerary_id = itinerary.id
                AND user_group.status = 'ACTIVE'
                AND user_group.deleted_at IS NULL
                AND member.user_id = $2::uuid
            )
          )
        LIMIT 1
      `,
      [itineraryId, userId],
    );
    return rows[0] ?? null;
  }

  async listAccessible({
    itineraryId,
    userId,
    documentType = null,
  }) {
    const { rows } = await Database.query(
      `
        SELECT document.*,
          itinerary.id AS itinerary_id,
          asset.original_filename,
          asset.mime_type,
          asset.extension,
          asset.file_size
        FROM trip.trip_documents document
        INNER JOIN trip.trips trip_record
          ON trip_record.id = document.trip_id
        INNER JOIN itinerary.itineraries itinerary
          ON itinerary.id = trip_record.itinerary_id
        INNER JOIN media.assets asset
          ON asset.id = document.asset_id
          AND asset.deleted_at IS NULL
        WHERE itinerary.id = $1::uuid
          AND itinerary.deleted_at IS NULL
          AND document.deleted_at IS NULL
          AND ($3::varchar IS NULL OR document.document_type = $3)
          AND (
            document.owner_id = $2::uuid
            OR (
              document.visibility = 'GROUP'
              AND EXISTS (
                SELECT 1
                FROM groups.groups user_group
                INNER JOIN groups.group_members member
                  ON member.group_id = user_group.id
                  AND member.status = 'ACTIVE'
                WHERE user_group.itinerary_id = itinerary.id
                  AND user_group.status = 'ACTIVE'
                  AND user_group.deleted_at IS NULL
                  AND member.user_id = $2::uuid
              )
            )
          )
        ORDER BY document.created_at DESC, document.id DESC
      `,
      [itineraryId, userId, documentType],
    );
    return rows;
  }

  async deleteOwned({
    itineraryId,
    documentId,
    userId,
  }) {
    const { rows } =
      await Database.query(
        `
          UPDATE trip.trip_documents document
          SET
            deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          FROM trip.trips trip_record,
            itinerary.itineraries itinerary
          WHERE document.id = $2::uuid
            AND document.owner_id = $3::uuid
            AND document.deleted_at IS NULL
            AND trip_record.id = document.trip_id
            AND itinerary.id = $1::uuid
            AND itinerary.id =
              trip_record.itinerary_id
            AND itinerary.deleted_at IS NULL
          RETURNING
            document.id,
            itinerary.id AS itinerary_id,
            document.deleted_at
        `,
        [
          itineraryId,
          documentId,
          userId,
        ],
      );

    return rows[0] ?? null;
  }

  async findOwnedForDownload({
    itineraryId,
    documentId,
    userId,
  }) {
    const { rows } = await Database.query(
      `
        SELECT
          document.id,
          document.asset_id,
          asset.original_filename,
          asset.mime_type
        FROM trip.trip_documents document
        INNER JOIN trip.trips trip_record
          ON trip_record.id = document.trip_id
        INNER JOIN itinerary.itineraries itinerary
          ON itinerary.id = trip_record.itinerary_id
        INNER JOIN media.assets asset
          ON asset.id = document.asset_id
          AND asset.deleted_at IS NULL
        WHERE itinerary.id = $1::uuid
          AND itinerary.created_by = $3::uuid
          AND itinerary.deleted_at IS NULL
          AND document.id = $2::uuid
          AND document.owner_id = $3::uuid
          AND document.deleted_at IS NULL
        LIMIT 1
      `,
      [itineraryId, documentId, userId],
    );
    return rows[0] ?? null;
  }

  async findAccessibleForDownload({
    itineraryId,
    documentId,
    userId,
  }) {
    const { rows } = await Database.query(
      `
        SELECT document.id, document.asset_id,
          asset.original_filename, asset.mime_type, asset.storage_provider, asset.storage_key
        FROM trip.trip_documents document
        INNER JOIN trip.trips trip_record
          ON trip_record.id = document.trip_id
        INNER JOIN itinerary.itineraries itinerary
          ON itinerary.id = trip_record.itinerary_id
          AND itinerary.deleted_at IS NULL
        INNER JOIN media.assets asset
          ON asset.id = document.asset_id
          AND asset.deleted_at IS NULL
        WHERE itinerary.id = $1::uuid
          AND document.id = $2::uuid
          AND document.deleted_at IS NULL
          AND (
            document.owner_id = $3::uuid
            OR (
              document.visibility = 'GROUP'
              AND EXISTS (
                SELECT 1
                FROM groups.groups user_group
                INNER JOIN groups.group_members member
                  ON member.group_id = user_group.id
                  AND member.status = 'ACTIVE'
                WHERE user_group.itinerary_id = itinerary.id
                  AND user_group.status = 'ACTIVE'
                  AND user_group.deleted_at IS NULL
                  AND member.user_id = $3::uuid
              )
            )
          )
        LIMIT 1
      `,
      [itineraryId, documentId, userId],
    );
    return rows[0] ?? null;
  }

  async updateVisibilityOwned({
    itineraryId,
    documentId,
    userId,
    visibility,
  }) {
    return Database.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [itineraryId]);
      const { rows: owned } = await client.query(`
        SELECT d.id FROM trip.trip_documents d
        JOIN trip.trips t ON t.id=d.trip_id
        JOIN itinerary.itineraries i ON i.id=t.itinerary_id AND i.deleted_at IS NULL
        WHERE i.id=$1::uuid AND d.id=$2::uuid AND d.owner_id=$3::uuid AND d.deleted_at IS NULL
        FOR UPDATE OF d
      `, [itineraryId, documentId, userId]);
      if (!owned.length) { return null; }
      if (visibility === 'GROUP') {
        const { rows: membership } = await client.query(`
          SELECT g.id FROM groups.groups g
          JOIN groups.group_members m ON m.group_id=g.id AND m.status='ACTIVE'
          WHERE g.itinerary_id=$1::uuid AND g.status='ACTIVE' AND g.deleted_at IS NULL
            AND m.user_id=$2::uuid
        `, [itineraryId, userId]);
        if (!membership.length) { return { groupRequired: true }; }
      }
    const { rows } = await client.query(
      `
        UPDATE trip.trip_documents document
        SET visibility = $4,
          updated_at = CURRENT_TIMESTAMP
        FROM trip.trips trip_record,
          itinerary.itineraries itinerary
        WHERE document.id = $2::uuid
          AND document.owner_id = $3::uuid
          AND document.deleted_at IS NULL
          AND trip_record.id = document.trip_id
          AND itinerary.id = $1::uuid
          AND itinerary.id = trip_record.itinerary_id
          AND itinerary.deleted_at IS NULL
        RETURNING document.*, itinerary.id AS itinerary_id
      `,
      [itineraryId, documentId, userId, visibility],
    );
    return rows[0] ?? null;
    });
  }

  async hasActiveLinkedGroup({ itineraryId }) {
    const { rows } = await Database.query(
      `SELECT 1
       FROM groups.groups
       WHERE itinerary_id = $1::uuid
         AND status = 'ACTIVE'
         AND deleted_at IS NULL
       LIMIT 1`,
      [itineraryId],
    );
    return Boolean(rows[0]);
  }
}

export default new ItineraryVaultRepository();
