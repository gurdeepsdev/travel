import Database
  from "../../../database/database-manager.js";

class CitySavesRepository {
  async save({
    cityId,
    userId,
  }) {
    const sql = `
      WITH target_city AS (
        SELECT city.id
        FROM poi.cities city
        WHERE city.id = $2::uuid
          AND city.is_active IS TRUE
        FOR KEY SHARE
      )

      INSERT INTO users.saved_items
        AS saved_item (
          user_id,
          item_type,
          item_id,
          is_active
        )

      SELECT
        $1::uuid,
        'CITY',
        target_city.id,
        TRUE
      FROM target_city

      ON CONFLICT (
        user_id,
        item_type,
        item_id
      )
      DO UPDATE SET
        is_active = TRUE,
        created_at = CASE
          WHEN saved_item.is_active IS TRUE
          THEN saved_item.created_at
          ELSE CURRENT_TIMESTAMP
        END

      RETURNING
        id,
        user_id,
        item_type,
        item_id,
        is_active,
        created_at
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          userId,
          cityId,
        ],
      );

    return rows[0] ?? null;
  }

  async remove({
    cityId,
    userId,
  }) {
    const sql = `
      UPDATE users.saved_items
      SET is_active = FALSE
      WHERE user_id = $1::uuid
        AND item_type = 'CITY'
        AND item_id = $2::uuid
        AND is_active IS TRUE
    `;

    await Database.query(
      sql,
      [
        userId,
        cityId,
      ],
    );
  }

  async getState({
    cityId,
    userId,
  }) {
    const sql = `
      SELECT
        saved_item.id,
        saved_item.user_id,
        saved_item.item_type,
        saved_item.item_id,
        saved_item.is_active,
        saved_item.created_at
      FROM users.saved_items saved_item
      INNER JOIN poi.cities city
        ON city.id = saved_item.item_id
        AND city.is_active IS TRUE
      WHERE saved_item.user_id = $1::uuid
        AND saved_item.item_type = 'CITY'
        AND saved_item.item_id = $2::uuid
      LIMIT 1
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          userId,
          cityId,
        ],
      );

    return rows[0] ?? null;
  }

  async findActiveCity({
    cityId,
  }) {
    const sql = `
      SELECT city.id
      FROM poi.cities city
      WHERE city.id = $1::uuid
        AND city.is_active IS TRUE
      LIMIT 1
    `;

    const { rows } =
      await Database.query(
        sql,
        [
          cityId,
        ],
      );

    return rows[0] ?? null;
  }
}

export default new CitySavesRepository();
