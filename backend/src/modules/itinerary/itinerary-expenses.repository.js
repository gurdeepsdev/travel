import Database from "../../database/database-manager.js";

class ItineraryExpensesRepository {
  async findAccessibleTrip({ itineraryId, userId }) {
    const { rows } = await Database.query(
      `
        SELECT trip_record.id AS trip_id
        FROM itinerary.itineraries itinerary_record
        INNER JOIN trip.trips trip_record
          ON trip_record.itinerary_id = itinerary_record.id
        WHERE itinerary_record.id = $1::uuid
          AND itinerary_record.deleted_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM trip.trip_participants participant
            WHERE participant.trip_id = trip_record.id
              AND participant.user_id = $2::uuid
              AND participant.status = 'ACTIVE'
          )
        LIMIT 1
      `,
      [itineraryId, userId],
    );
    return rows[0] ?? null;
  }

  async findActiveParticipantIds({ tripId, userIds }) {
    const { rows } = await Database.query(
      `
        SELECT user_id
        FROM trip.trip_participants
        WHERE trip_id = $1::uuid
          AND status = 'ACTIVE'
          AND user_id = ANY($2::uuid[])
      `,
      [tripId, userIds],
    );
    return rows.map((row) => row.user_id);
  }

  async receiptBelongsToUser({ assetId, userId }) {
    const { rows } = await Database.query(
      `
        SELECT id
        FROM media.assets
        WHERE id = $1::uuid
          AND uploaded_by = $2::uuid
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [assetId, userId],
    );
    return Boolean(rows[0]);
  }

  async create({ tripId, createdBy, input, splits }) {
    return Database.transaction(async (client) => {
      const expenseResult = await client.query(
        `
          INSERT INTO trip.trip_expenses (
            trip_id, paid_by, created_by, expense_category,
            title, description, amount, currency_code,
            payment_method, expense_date, receipt_asset_id,
            location_name, split_type
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid, $4, $5, $6,
            $7::numeric, $8, $9, $10::date, $11::uuid, $12, $13
          )
          RETURNING *
        `,
        [
          tripId, input.paidBy, createdBy, input.category,
          input.title, input.description ?? null, input.amount,
          input.currencyCode, input.paymentMethod, input.expenseDate,
          input.receiptAssetId ?? null, input.locationName ?? null,
          input.splitType,
        ],
      );
      const expense = expenseResult.rows[0];
      const splitRows = [];

      for (const split of splits) {
        const splitResult = await client.query(
          `
            INSERT INTO trip.trip_expense_splits (
              expense_id, user_id, amount, percentage
            ) VALUES ($1::uuid, $2::uuid, $3::numeric, $4::numeric)
            RETURNING *
          `,
          [expense.id, split.userId, split.amount, split.percentage],
        );
        splitRows.push(splitResult.rows[0]);
      }

      return { expense, splits: splitRows };
    });
  }

  async list({ tripId, viewerUserId, limit, cursor, category }) {
    const { rows } = await Database.query(
      `
        SELECT
          expense.*,
          payer_profile.username AS payer_username,
          payer_profile.display_name AS payer_display_name,
          payer_photo.id AS payer_photo_id,
          payer_photo.storage_provider AS payer_photo_storage_provider,
          payer_photo.storage_key AS payer_photo_storage_key,
          payer_photo.is_public AS payer_photo_is_public,
          payer_photo.mime_type AS payer_photo_mime_type,
          creator_profile.username AS creator_username,
          creator_profile.display_name AS creator_display_name,
          receipt.storage_provider AS receipt_storage_provider,
          receipt.storage_key AS receipt_storage_key,
          receipt.is_public AS receipt_is_public,
          receipt.mime_type AS receipt_mime_type,
          COALESCE(split_data.splits, '[]'::jsonb) AS splits,
          COALESCE(split_data.viewer_share, 0) AS viewer_share
        FROM trip.trip_expenses expense
        INNER JOIN users.profiles payer_profile
          ON payer_profile.user_id = expense.paid_by
          AND payer_profile.deleted_at IS NULL
        INNER JOIN users.profiles creator_profile
          ON creator_profile.user_id = expense.created_by
          AND creator_profile.deleted_at IS NULL
        LEFT JOIN media.assets payer_photo
          ON payer_photo.id = payer_profile.profile_photo_asset_id
          AND payer_photo.deleted_at IS NULL
        LEFT JOIN media.assets receipt
          ON receipt.id = expense.receipt_asset_id
          AND receipt.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'id', split.id,
                'userId', split.user_id,
                'username', profile.username,
                'displayName', profile.display_name,
                'amount', split.amount,
                'percentage', split.percentage,
                'settlementStatus', split.settlement_status
              ) ORDER BY split.created_at, split.id
            ) AS splits,
            MAX(split.amount) FILTER (
              WHERE split.user_id = $2::uuid
            ) AS viewer_share
          FROM trip.trip_expense_splits split
          INNER JOIN users.profiles profile
            ON profile.user_id = split.user_id
            AND profile.deleted_at IS NULL
          WHERE split.expense_id = expense.id
        ) split_data ON TRUE
        WHERE expense.trip_id = $1::uuid
          AND expense.deleted_at IS NULL
          AND ($5::varchar IS NULL OR expense.expense_category = $5)
          AND (
            $3::timestamp IS NULL
            OR (expense.created_at, expense.id) < ($3::timestamp, $4::uuid)
          )
        ORDER BY expense.created_at DESC, expense.id DESC
        LIMIT $6
      `,
      [
        tripId,
        viewerUserId,
        cursor?.createdAt ?? null,
        cursor?.id ?? null,
        category ?? null,
        limit + 1,
      ],
    );

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      rows: pageRows,
      hasMore,
      lastRow: pageRows.at(-1) ?? null,
    };
  }

  async findById({ tripId, expenseId, viewerUserId }) {
    const { rows } = await Database.query(
      `
        SELECT
          expense.*,
          payer_profile.username AS payer_username,
          payer_profile.display_name AS payer_display_name,
          payer_photo.id AS payer_photo_id,
          payer_photo.storage_provider AS payer_photo_storage_provider,
          payer_photo.storage_key AS payer_photo_storage_key,
          payer_photo.is_public AS payer_photo_is_public,
          payer_photo.mime_type AS payer_photo_mime_type,
          creator_profile.username AS creator_username,
          creator_profile.display_name AS creator_display_name,
          receipt.storage_provider AS receipt_storage_provider,
          receipt.storage_key AS receipt_storage_key,
          receipt.is_public AS receipt_is_public,
          receipt.mime_type AS receipt_mime_type,
          COALESCE(split_data.splits, '[]'::jsonb) AS splits,
          COALESCE(split_data.viewer_share, 0) AS viewer_share
        FROM trip.trip_expenses expense
        INNER JOIN users.profiles payer_profile
          ON payer_profile.user_id = expense.paid_by
          AND payer_profile.deleted_at IS NULL
        INNER JOIN users.profiles creator_profile
          ON creator_profile.user_id = expense.created_by
          AND creator_profile.deleted_at IS NULL
        LEFT JOIN media.assets payer_photo
          ON payer_photo.id = payer_profile.profile_photo_asset_id
          AND payer_photo.deleted_at IS NULL
        LEFT JOIN media.assets receipt
          ON receipt.id = expense.receipt_asset_id
          AND receipt.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT
            jsonb_agg(
              jsonb_build_object(
                'id', split.id,
                'userId', split.user_id,
                'username', profile.username,
                'displayName', profile.display_name,
                'amount', split.amount,
                'percentage', split.percentage,
                'settlementStatus', split.settlement_status
              ) ORDER BY split.created_at, split.id
            ) AS splits,
            MAX(split.amount) FILTER (
              WHERE split.user_id = $3::uuid
            ) AS viewer_share
          FROM trip.trip_expense_splits split
          INNER JOIN users.profiles profile
            ON profile.user_id = split.user_id
            AND profile.deleted_at IS NULL
          WHERE split.expense_id = expense.id
        ) split_data ON TRUE
        WHERE expense.id = $2::uuid
          AND expense.trip_id = $1::uuid
          AND expense.deleted_at IS NULL
        LIMIT 1
      `,
      [tripId, expenseId, viewerUserId],
    );

    return rows[0] ?? null;
  }

  async findEditable({ itineraryId, expenseId, userId }) {
    const { rows } = await Database.query(
      `
        SELECT expense.*, trip_record.id AS resolved_trip_id,
          itinerary_record.created_by AS itinerary_owner_id
        FROM trip.trip_expenses expense
        INNER JOIN trip.trips trip_record
          ON trip_record.id = expense.trip_id
        INNER JOIN itinerary.itineraries itinerary_record
          ON itinerary_record.id = trip_record.itinerary_id
          AND itinerary_record.deleted_at IS NULL
        INNER JOIN trip.trip_participants viewer
          ON viewer.trip_id = trip_record.id
          AND viewer.user_id = $3::uuid
          AND viewer.status = 'ACTIVE'
        WHERE itinerary_record.id = $1::uuid
          AND expense.id = $2::uuid
          AND expense.deleted_at IS NULL
          AND (
            expense.created_by = $3::uuid
            OR itinerary_record.created_by = $3::uuid
          )
        LIMIT 1
      `,
      [itineraryId, expenseId, userId],
    );
    return rows[0] ?? null;
  }

  async update({ expenseId, input }) {
    const has = (field) => Object.hasOwn(input, field);
    const { rows } = await Database.query(
      `
        UPDATE trip.trip_expenses
        SET
          paid_by = CASE WHEN $2 THEN $3::uuid ELSE paid_by END,
          expense_category = CASE WHEN $4 THEN $5 ELSE expense_category END,
          title = CASE WHEN $6 THEN $7 ELSE title END,
          description = CASE WHEN $8 THEN $9 ELSE description END,
          payment_method = CASE WHEN $10 THEN $11 ELSE payment_method END,
          expense_date = CASE WHEN $12 THEN $13::date ELSE expense_date END,
          receipt_asset_id = CASE WHEN $14 THEN $15::uuid ELSE receipt_asset_id END,
          location_name = CASE WHEN $16 THEN $17 ELSE location_name END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::uuid
          AND deleted_at IS NULL
        RETURNING *
      `,
      [
        expenseId,
        has("paidBy"), input.paidBy ?? null,
        has("category"), input.category ?? null,
        has("title"), input.title ?? null,
        has("description"), input.description ?? null,
        has("paymentMethod"), input.paymentMethod ?? null,
        has("expenseDate"), input.expenseDate ?? null,
        has("receiptAssetId"), input.receiptAssetId ?? null,
        has("locationName"), input.locationName ?? null,
      ],
    );
    return rows[0] ?? null;
  }

  async replaceSplits({ expenseId, amount, splitType, splits }) {
    return Database.transaction(async (client) => {
      const expenseResult = await client.query(
        `
          UPDATE trip.trip_expenses
          SET amount = $2::numeric,
            split_type = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1::uuid AND deleted_at IS NULL
          RETURNING *
        `,
        [expenseId, amount, splitType],
      );
      if (!expenseResult.rows[0]) {
        return null;
      }

      await client.query(
        "DELETE FROM trip.trip_expense_splits WHERE expense_id = $1::uuid",
        [expenseId],
      );
      const rows = [];
      for (const split of splits) {
        const result = await client.query(
          `INSERT INTO trip.trip_expense_splits
            (expense_id, user_id, amount, percentage)
           VALUES ($1::uuid, $2::uuid, $3::numeric, $4::numeric)
           RETURNING *`,
          [expenseId, split.userId, split.amount, split.percentage],
        );
        rows.push(result.rows[0]);
      }
      return { expense: expenseResult.rows[0], splits: rows };
    });
  }

  async softDelete({ expenseId }) {
    const { rows } = await Database.query(
      `UPDATE trip.trip_expenses
       SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid AND deleted_at IS NULL
       RETURNING id, deleted_at`,
      [expenseId],
    );
    return rows[0] ?? null;
  }

  async getSummary({ tripId }) {
    const { rows } = await Database.query(
      `
        SELECT
          (SELECT COUNT(*)::integer FROM trip.trip_expenses
           WHERE trip_id = $1::uuid AND deleted_at IS NULL) AS expense_count,
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'currencyCode', currency_code,
                'totalAmount', total_amount,
                'categories', categories
              ) ORDER BY currency_code
            )
            FROM (
              SELECT currency_code,
                SUM(category_total) AS total_amount,
                jsonb_object_agg(
                  expense_category, category_total ORDER BY expense_category
                ) AS categories
              FROM (
                SELECT TRIM(currency_code) AS currency_code,
                  expense_category, SUM(amount) AS category_total
                FROM trip.trip_expenses
                WHERE trip_id = $1::uuid AND deleted_at IS NULL
                GROUP BY TRIM(currency_code), expense_category
              ) category_totals
              GROUP BY currency_code
            ) currency_totals
          ), '[]'::jsonb) AS totals
      `,
      [tripId],
    );
    return rows[0];
  }

  async getBalances({ tripId }) {
    const { rows } = await Database.query(
      `
        WITH paid AS (
          SELECT paid_by AS user_id, TRIM(currency_code) AS currency_code,
            SUM(amount) AS paid_amount
          FROM trip.trip_expenses
          WHERE trip_id = $1::uuid AND deleted_at IS NULL
          GROUP BY paid_by, TRIM(currency_code)
        ),
        shares AS (
          SELECT split.user_id, TRIM(expense.currency_code) AS currency_code,
            SUM(split.amount) AS share_amount
          FROM trip.trip_expense_splits split
          INNER JOIN trip.trip_expenses expense ON expense.id = split.expense_id
          WHERE expense.trip_id = $1::uuid AND expense.deleted_at IS NULL
          GROUP BY split.user_id, TRIM(expense.currency_code)
        ),
        settlements AS (
          SELECT from_user_id AS user_id, TRIM(currency_code) AS currency_code,
            SUM(amount) AS outbound_amount, 0::numeric AS inbound_amount
          FROM trip.trip_expense_settlements
          WHERE trip_id = $1::uuid AND status = 'CONFIRMED'
          GROUP BY from_user_id, TRIM(currency_code)
          UNION ALL
          SELECT to_user_id, TRIM(currency_code), 0::numeric, SUM(amount)
          FROM trip.trip_expense_settlements
          WHERE trip_id = $1::uuid AND status = 'CONFIRMED'
          GROUP BY to_user_id, TRIM(currency_code)
        ), settlement_totals AS (
          SELECT user_id, currency_code, SUM(outbound_amount) AS outbound_amount,
            SUM(inbound_amount) AS inbound_amount
          FROM settlements GROUP BY user_id, currency_code
        ), keys AS (
          SELECT user_id, currency_code FROM paid
          UNION
          SELECT user_id, currency_code FROM shares
          UNION
          SELECT user_id, currency_code FROM settlement_totals
        )
        SELECT keys.user_id, profile.username, profile.display_name,
          keys.currency_code,
          COALESCE(paid.paid_amount, 0) AS paid_amount,
          COALESCE(shares.share_amount, 0) AS share_amount,
          COALESCE(paid.paid_amount, 0) - COALESCE(shares.share_amount, 0)
            + COALESCE(settlement_totals.outbound_amount, 0)
            - COALESCE(settlement_totals.inbound_amount, 0)
            AS net_amount
        FROM keys
        INNER JOIN users.profiles profile
          ON profile.user_id = keys.user_id AND profile.deleted_at IS NULL
        LEFT JOIN paid
          ON paid.user_id = keys.user_id
          AND paid.currency_code = keys.currency_code
        LEFT JOIN shares
          ON shares.user_id = keys.user_id
          AND shares.currency_code = keys.currency_code
        LEFT JOIN settlement_totals
          ON settlement_totals.user_id = keys.user_id
          AND settlement_totals.currency_code = keys.currency_code
        ORDER BY keys.currency_code, net_amount DESC, keys.user_id
      `,
      [tripId],
    );
    return rows;
  }
}

export default new ItineraryExpensesRepository();
