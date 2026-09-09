import Database from "../../database/database-manager.js";

class ItineraryExpenseSettlementsRepository {
  async create({ tripId, userId, input }) {
    const { rows } = await Database.query(
      `WITH inserted AS (
         INSERT INTO trip.trip_expense_settlements
           (trip_id, from_user_id, to_user_id, amount, currency_code, created_by)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric, $5, $2::uuid)
         RETURNING *
       )
       SELECT inserted.*,
         sender.username AS from_username,
         sender.display_name AS from_display_name,
         receiver.username AS to_username,
         receiver.display_name AS to_display_name
       FROM inserted
       INNER JOIN users.profiles sender
         ON sender.user_id = inserted.from_user_id AND sender.deleted_at IS NULL
       INNER JOIN users.profiles receiver
         ON receiver.user_id = inserted.to_user_id AND receiver.deleted_at IS NULL`,
      [tripId, userId, input.toUserId, input.amount, input.currencyCode],
    );
    return rows[0];
  }

  async list({ tripId, limit, cursor, status }) {
    const { rows } = await Database.query(
      `SELECT settlement.*,
        sender.username AS from_username,
        sender.display_name AS from_display_name,
        receiver.username AS to_username,
        receiver.display_name AS to_display_name
       FROM trip.trip_expense_settlements settlement
       INNER JOIN users.profiles sender
         ON sender.user_id = settlement.from_user_id AND sender.deleted_at IS NULL
       INNER JOIN users.profiles receiver
         ON receiver.user_id = settlement.to_user_id AND receiver.deleted_at IS NULL
       WHERE settlement.trip_id = $1::uuid
         AND ($4::varchar IS NULL OR settlement.status = $4)
         AND ($2::timestamp IS NULL OR
           (settlement.created_at, settlement.id) < ($2::timestamp, $3::uuid))
       ORDER BY settlement.created_at DESC, settlement.id DESC
       LIMIT $5`,
      [tripId, cursor?.createdAt ?? null, cursor?.id ?? null, status ?? null, limit + 1],
    );
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return { rows: pageRows, hasMore, lastRow: pageRows.at(-1) ?? null };
  }

  async findById({ tripId, settlementId }) {
    const { rows } = await Database.query(
      `SELECT * FROM trip.trip_expense_settlements
       WHERE id = $2::uuid AND trip_id = $1::uuid LIMIT 1`,
      [tripId, settlementId],
    );
    return rows[0] ?? null;
  }

  async resolve({ settlementId, userId, status }) {
    const { rows } = await Database.query(
      `UPDATE trip.trip_expense_settlements
       SET status = $3, resolved_by = $2::uuid, resolved_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid AND status = 'PENDING'
         AND (($3 IN ('CONFIRMED', 'REJECTED') AND to_user_id = $2::uuid)
           OR ($3 = 'CANCELLED' AND from_user_id = $2::uuid))
       RETURNING *`,
      [settlementId, userId, status],
    );
    return rows[0] ?? null;
  }
}

export default new ItineraryExpenseSettlementsRepository();
