import Database from "../../database/database-manager.js";
import { lockExpenseParticipants, lockExpenseTrip } from "./expense-write-lock.js";
import ExpensesRepository from "./itinerary-expenses.repository.js";
import AppError from "../../core/errors/app-error.js";

class ItineraryExpenseSettlementsRepository {
  async assertCapacity(client, { tripId, fromUserId, toUserId, amount, currencyCode, excludeId = null }) {
    const balances = await ExpensesRepository.getBalances({ tripId }, client);
    const net = (id) => balances.find(row => row.user_id === id
      && row.currency_code === currencyCode)?.net_amount ?? "0";
    // Reserve every pending outgoing/incoming amount, including other counterparties.
    // PostgreSQL NUMERIC keeps aggregate comparisons exact, without JS float rounding.
    const { rows: [capacity] } = await client.query(`
      SELECT $6::numeric > 0 AND $6::numeric <= LEAST(
        -$7::numeric - COALESCE(SUM(amount) FILTER (WHERE from_user_id=$3::uuid), 0),
         $8::numeric - COALESCE(SUM(amount) FILTER (WHERE to_user_id=$4::uuid), 0)
      ) AS allowed
      FROM trip.trip_expense_settlements
      WHERE trip_id=$1::uuid AND currency_code=$2 AND status='PENDING'
        AND ($5::uuid IS NULL OR id<>$5::uuid)
    `, [tripId, currencyCode, fromUserId, toUserId, excludeId, amount,
      net(fromUserId), net(toUserId)]);
    if (!capacity.allowed) {
      throw new AppError({ code: "ITINERARY.EXPENSE_SETTLEMENT_INVALID", statusCode: 422,
        message: "Settlement exceeds the current outstanding balance after pending reservations. Cancel or reject stale pending settlements and retry." });
    }
  }

  async create({ tripId, userId, input }) {
    return Database.transaction(async client => {
      await lockExpenseParticipants(client, tripId, [userId, input.toUserId]);
      await this.assertCapacity(client, { tripId, fromUserId: userId,
        toUserId: input.toUserId, amount: input.amount, currencyCode: input.currencyCode });
      const { rows } = await client.query(
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
    });
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

  async resolve({ tripId, settlementId, userId, status }) {
    return Database.transaction(async client => {
      await lockExpenseTrip(client, tripId);
      const { rows: [existing] } = await client.query(`
        SELECT * FROM trip.trip_expense_settlements
        WHERE id=$1::uuid AND trip_id=$2::uuid AND status='PENDING'
          AND (($3 IN ('CONFIRMED','REJECTED') AND to_user_id=$4::uuid)
            OR ($3='CANCELLED' AND from_user_id=$4::uuid))
        FOR UPDATE
      `, [settlementId, tripId, status, userId]);
      if (!existing) {
        return null;
      }
      await lockExpenseParticipants(client, tripId, status === "CONFIRMED"
        ? [existing.from_user_id, existing.to_user_id] : [userId]);
      if (status === "CONFIRMED") {
        await this.assertCapacity(client, { tripId, fromUserId: existing.from_user_id,
          toUserId: existing.to_user_id, amount: existing.amount,
          currencyCode: existing.currency_code.trim(), excludeId: settlementId });
      }
      const { rows } = await client.query(
        `UPDATE trip.trip_expense_settlements
         SET status = $3, resolved_by = $2::uuid, resolved_at = CURRENT_TIMESTAMP
         WHERE id = $1::uuid AND status = 'PENDING'
           AND (($3 IN ('CONFIRMED', 'REJECTED') AND to_user_id = $2::uuid)
             OR ($3 = 'CANCELLED' AND from_user_id = $2::uuid))
         RETURNING *`,
        [settlementId, userId, status],
      );
      return rows[0] ?? null;
    });
  }
}

export default new ItineraryExpenseSettlementsRepository();
