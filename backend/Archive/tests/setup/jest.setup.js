// beforeAll(async () => {

//     process.env.NODE_ENV = "test";

// });

// afterAll(async () => {

// });

import DatabaseManager from "../../src/database/database-manager.js";

beforeAll(() => {
  process.env.NODE_ENV = "test";
});

afterAll(async () => {
  if (!DatabaseManager.pool.ended) {
    await DatabaseManager.pool.end();
  }
});
