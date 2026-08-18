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

  async healthCheck() {
    await this.query("SELECT 1");
    return true;
  }
}

export default new DatabaseManager();