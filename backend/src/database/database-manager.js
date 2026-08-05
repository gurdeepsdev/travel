import pg from "pg";
import env from "../config/env.js";

const { Pool } = pg;

class DatabaseManager {
  constructor() {
    this.pool = new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    });
  }

  async query(text, params = []) {
    return this.pool.query(text, params);
  }

  async getClient() {
    return this.pool.connect();
  }

    async transaction(callback) {
    if (
      typeof callback !==
      "function"
    ) {
      throw new TypeError(
        "Database transaction callback must be a function.",
      );
    }

    const client =
      await this.getClient();

    try {
      await client.query(
        "BEGIN",
      );

      const result =
        await callback(
          client,
        );

      await client.query(
        "COMMIT",
      );

      return result;
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK",
        );
      } catch (
        rollbackError
      ) {
        error.rollbackError =
          rollbackError;
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck() {
    await this.query("SELECT 1");
    return true;
  }
}

export default new DatabaseManager();