import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import db from "../../src/database/database-manager.js";
import env from "../../src/config/env.js";
import jwt from "../../src/core/security/jwt.js";
import redis from "../../src/config/redis.js";
import app from "../../src/app.js";

assert(["development", "test"].includes(env.NODE_ENV));
assert(["localhost", "127.0.0.1", "::1"].includes(env.DB_HOST));
const client = await db.getClient(),
  original = db.query;
await client.query("BEGIN");
db.query = (...args) => client.query(...args);
let checks = 0;
try {
  const user = randomUUID(),
    other = randomUUID(),
    sid = randomUUID();
  for (const id of [user, other]) {
    await client.query(
      "INSERT INTO auth.users(id,status) VALUES($1,'ACTIVE')",
      [id],
    );
    await client.query(
      "INSERT INTO users.profiles(user_id,username) VALUES($1,$2)",
      [id, "saved_" + id.replaceAll("-", "")],
    );
  }
  await client.query(
    "INSERT INTO auth.sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,'fixture',$3)",
    [sid, user, new Date(Date.now() + 86400000)],
  );
  const token = jwt.generateAccessToken({ sub: user, sid, ver: 1 });
  const get = async (query = "", status = 200) => {
    const r = await request(app)
      .get("/api/v1/users/me/saved-posts" + query)
      .set("Authorization", "Bearer " + token);
    assert.equal(r.status, status, JSON.stringify(r.body));
    checks++;
    return r.body.data;
  };
  const city = (
    await client.query(
      "SELECT id,country_id FROM poi.cities WHERE is_active IS TRUE AND country_id IS NOT NULL LIMIT 1",
    )
  ).rows[0];
  assert(city, "Active city fixture prerequisite");
  const place = (
    await client.query("SELECT id FROM poi.places WHERE city_id=$1 LIMIT 1", [
      city.id,
    ])
  ).rows[0];
  assert(place, "Place fixture prerequisite");
  const post = randomUUID(),
    privatePost = randomUUID(),
    deletedPost = randomUUID();
  for (const [id, owner, visibility, deleted] of [
    [post, user, "PRIVATE", null],
    [privatePost, other, "PRIVATE", null],
    [deletedPost, user, "PUBLIC", new Date()],
  ]) {
    await client.query(
      "INSERT INTO explore.posts(id,user_id,post_type,visibility,city_id,deleted_at) VALUES($1,$2,$3,$4,$5,$6)",
      [id, owner, "CITY", visibility, city.id, deleted],
    );
  }
  const save = async (type, id, owner = user, active = true) =>
    client.query(
      "INSERT INTO users.saved_items(user_id,item_type,item_id,is_active,created_at) VALUES($1,$2,$3,$4,'2026-09-16 00:00:00.123456')",
      [owner, type, id, active],
    );
  await save("POST", post);
  await save("CITY", city.id);
  await save("PLACE", place.id);
  await save("POST", privatePost);
  await save("POST", deletedPost);
  await save("CITY", randomUUID());
  await save("PLACE", randomUUID());
  await save("POST", randomUUID(), user, false);
  await save("CITY", city.id, other);
  const full = await get();
  assert.equal(full.posts.length, 3);
  assert.deepEqual(full.posts.map((x) => x.itemType).sort(), [
    "CITY",
    "PLACE",
    "POST",
  ]);
  assert.equal(
    full.posts.find((x) => x.itemType === "POST").visibility,
    "PRIVATE",
  );
  assert.equal(full.posts.find((x) => x.itemType === "CITY").city.id, city.id);
  assert.equal(full.posts.find((x) => x.itemType === "PLACE").id, place.id);
  assert(full.posts.every((x) => x.viewerState.saved));
  const paged = [];
  let cursor = null;
  do {
    const page = await get("?limit=1" + (cursor ? "&cursor=" + cursor : ""));
    assert.equal(page.posts.length, 1);
    paged.push(page.posts[0]);
    cursor = page.pagination.nextCursor;
    assert.equal(page.pagination.hasMore, !!cursor);
    assert(paged.length <= 3);
  } while (cursor);
  assert.deepEqual(paged, full.posts);
  assert.equal((await get("?cityId=" + city.id)).posts.length, 3);
  assert.equal((await get("?countryId=" + city.country_id)).posts.length, 3);
  assert.equal((await get("?cityId=" + randomUUID())).posts.length, 0);
  await get("?cityId=" + city.id + "&countryId=" + city.country_id, 400);
  await get("?cursor=bad", 400);
  await client.query(
    "UPDATE users.saved_items SET is_active=FALSE WHERE user_id=$1 AND item_type=$2",
    [user, "CITY"],
  );
  assert.equal((await get()).posts.length, 2);
  await client.query(
    "UPDATE users.saved_items SET is_active=TRUE WHERE user_id=$1 AND item_type=$2",
    [user, "CITY"],
  );
  await client.query("UPDATE poi.cities SET is_active=FALSE WHERE id=$1", [
    city.id,
  ]);
  assert(!(await get()).posts.some((x) => x.itemType === "CITY"));
  const anonymous = await request(app).get("/api/v1/users/me/saved-posts");
  assert.equal(anonymous.status, 401);
  checks++;
  console.log(
    "PASS",
    checks,
    "HTTP checks: mixed ordering, microsecond cursor ties, filters, own/private/deleted posts, orphan saves, isolation, inactive city, unsave and auth.",
  );
} finally {
  await client.query("ROLLBACK");
  db.query = original;
  client.release();
  await db.pool.end();
  redis.disconnect();
  console.log("All database fixtures rolled back.");
}
process.exit(0);
