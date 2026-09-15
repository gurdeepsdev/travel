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
  query = db.query,
  transaction = db.transaction;
const users = Array.from({ length: 4 }, () => randomUUID()),
  tokens = [];
let checks = 0,
  seq = 0;
await client.query("BEGIN");
db.query = (...args) => client.query(...args);
db.transaction = async (fn) => {
  const point = `personal_${++seq}`;
  await client.query(`SAVEPOINT ${point}`);
  try {
    const result = await fn(client);
    await client.query(`RELEASE SAVEPOINT ${point}`);
    return result;
  } catch (e) {
    await client.query(`ROLLBACK TO SAVEPOINT ${point}`);
    throw e;
  }
};
const call = async (method, path, actor, body, status = 200) => {
  const req = request(app)
    [method](`/api/v1${path}`)
    .set("Authorization", `Bearer ${tokens[actor]}`);
  const res = await (body === undefined ? req : req.send(body));
  assert.equal(
    res.status,
    status,
    `${method} ${path}: ${JSON.stringify(res.body)}`,
  );
  checks++;
  return res.body.data;
};
try {
  for (const id of users) {
    const sid = randomUUID();
    await client.query(
      "INSERT INTO auth.users(id,status) VALUES ($1,'ACTIVE')",
      [id],
    );
    await client.query(
      "INSERT INTO users.profiles(user_id,username) VALUES ($1,$2)",
      [id, `personal_${id.replaceAll("-", "")}`],
    );
    await client.query(
      "INSERT INTO auth.sessions(id,user_id,refresh_token_hash,expires_at) VALUES ($1,$2,'fixture',$3)",
      [sid, id, new Date(Date.now() + 86400000)],
    );
    tokens.push(jwt.generateAccessToken({ sub: id, sid, ver: 1 }));
  }
  const group = (
    await call("post", "/groups", 0, { name: "Four personal states" })
  ).group;
  for (let a = 1; a < 4; a++) {
    await client.query(
      "INSERT INTO users.connections(user_low_id,user_high_id) VALUES (LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid))",
      [users[0], users[a]],
    );
    const invite = (
      await call("post", `/groups/${group.id}/invitations`, 0, {
        userId: users[a],
      })
    ).invitation;
    await call("patch", `/users/me/group-invitations/${invite.id}`, a, {
      status: "ACCEPTED",
    });
  }

  const newTrip = async (memberCount = 4) => {
    const payload = {
      request_id: randomUUID(),
      status: "success",
      mode: "future",
      city_id: "delhi",
      summary: { num_days: 1, total_places: 1 },
      days: [{ day: 1, items: [{ item_type: "poi", place_id: "test-place" }] }],
    };
    const itinerary = (await call("post", "/itineraries", 0, payload, 201))
      .itinerary;
    const g = (
      await call("post", "/groups", 0, { name: "Settlement isolated test" })
    ).group;
    for (let a = 1; a < memberCount; a++) {
      const invite = (
        await call("post", `/groups/${g.id}/invitations`, 0, {
          userId: users[a],
        })
      ).invitation;
      await call("patch", `/users/me/group-invitations/${invite.id}`, a, {
        status: "ACCEPTED",
      });
    }
    await call("put", `/groups/${g.id}/itinerary`, 0, {
      itineraryId: itinerary.id,
    });
    return "/itineraries/" + itinerary.id;
  };
  const expense = async (base, payer, amount, actors) =>
    (
      await call(
        "post",
        base + "/expenses",
        payer,
        {
          paidBy: users[payer],
          category: "FOOD",
          title: "Isolated settlement verification",
          amount,
          currencyCode: "INR",
          paymentMethod: "CASH",
          expenseDate: "2026-09-15",
          splitType: "EQUAL",
          participants: actors.map((a) => ({ userId: users[a] })),
        },
        201,
      )
    ).expense;
  const create = async (base, from, to, amount) =>
    (
      await call(
        "post",
        base + "/expense-settlements",
        from,
        { toUserId: users[to], amount, currencyCode: "INR" },
        201,
      )
    ).settlement;
  const resolve = async (base, s, actor, status, expected = 200) =>
    call(
      "patch",
      base + "/expense-settlements/" + s.id,
      actor,
      { status },
      expected,
    );
  const nets = async (base) => {
    const b = await call("get", base + "/expense-balances", 0);
    return users.map(
      (id) => b.balances.find((x) => x.user.id === id)?.netAmount ?? 0,
    );
  };
  for (const n of [3, 4]) {
    const base = await newTrip(n);
    assert.equal(
      (await call("get", base + "/expense-participants", 0)).totalCount,
      n,
    );
    await expense(
      base,
      0,
      n * 100,
      Array.from({ length: n }, (_, i) => i),
    );
    assert.deepEqual(await nets(base), [
      100 * (n - 1),
      ...Array(n - 1).fill(-100),
      ...Array(4 - n).fill(0),
    ]);
    const first = await create(base, 1, 0, 40);
    await resolve(base, first, 1, "CONFIRMED", 404);
    await resolve(base, first, 2, "CONFIRMED", 404);
    await resolve(base, first, 0, "CONFIRMED");
    await resolve(base, first, 0, "CONFIRMED", 404);
    const rest = await create(base, 1, 0, 60);
    await resolve(base, rest, 0, "CONFIRMED");
    for (let a = 2; a < n; a++) {
      const s = await create(base, a, 0, 100);
      await resolve(base, s, 0, "CONFIRMED");
    }
    assert.deepEqual(await nets(base), [0, 0, 0, 0]);
    console.log(
      "NORMAL",
      n,
      "members: partial/full settlements, authorization, repeated-confirm guard PASS",
    );
  }
  {
    const base = await newTrip();
    await expense(base, 0, 200, [0, 1]);
    const a = await create(base, 1, 0, 100);
    await call(
      "post",
      base + "/expense-settlements",
      1,
      { toUserId: users[0], amount: 100, currencyCode: "INR" },
      422,
    );
    await resolve(base, a, 0, "CONFIRMED");
    assert.deepEqual(await nets(base), [0, 0, 0, 0]);
    for (let actor = 0; actor < 4; actor++) {
      const d = await call("get", base + "/expenses/dashboard", actor);
      assert.equal(d.expenseCount, 1);
      assert.equal(d.totals[0].totalAmount, 200);
      assert(d.balances.every((b) => b.netAmount === 0));
    }
    await expense(base, 1, 80, [0, 1]);
    assert.deepEqual(await nets(base), [-40, 40, 0, 0]);
    for (let actor = 0; actor < 4; actor++) {
      const d = await call("get", base + "/expenses/dashboard", actor);
      assert.equal(d.expenseCount, 2);
      assert.equal(d.totals[0].totalAmount, 280);
      assert.equal(d.totals[0].categories.FOOD, 280);
      assert.equal(
        d.balances.find((b) => b.user.id === users[0]).netAmount,
        -40,
      );
    }
    console.log(
      "Duplicate pending rejected; settled dashboards retain spend totals; new expense adds new debt PASS",
    );
  }
  {
    const base = await newTrip();
    await expense(base, 0, 200, [0, 1]);
    const s = await create(base, 1, 0, 100);
    await expense(base, 1, 200, [0, 1]);
    assert.deepEqual(await nets(base), [0, 0, 0, 0]);
    await resolve(base, s, 0, "CONFIRMED", 422);
    assert.deepEqual(await nets(base), [0, 0, 0, 0]);
    await resolve(base, s, 1, "CANCELLED");
    console.log(
      "Stale confirmation rejected after expense change; cancellation allowed PASS",
    );
  }
  {
    const base = await newTrip();
    await expense(base, 0, 200, [0, 1]);
    await expense(base, 1, 200, [1, 2]);
    assert.deepEqual(await nets(base), [100, 0, -100, 0]);
    const s = await create(base, 2, 0, 100);
    await resolve(base, s, 0, "CONFIRMED");
    assert.deepEqual(await nets(base), [0, 0, 0, 0]);
    console.log(
      "THREE member netting: C settles A although original debts C->B->A; mathematically correct PASS",
    );
  }
  {
    const base = await newTrip();
    await expense(base, 0, 200, [0, 1]);
    await expense(base, 2, 200, [2, 3]);
    assert.deepEqual(await nets(base), [100, -100, 100, -100]);
    const s = await create(base, 1, 2, 100);
    await resolve(base, s, 2, "CONFIRMED");
    const t = await create(base, 3, 0, 100);
    await resolve(base, t, 0, "CONFIRMED");
    assert.deepEqual(await nets(base), [0, 0, 0, 0]);
    console.log(
      "FOUR member netting: cross-pair settlements allowed; all net balances zero PASS",
    );
  }
  {
    const base = await newTrip();
    await expense(base, 0, 200, [0, 1]);
    const a = await create(base, 1, 0, 40);
    await resolve(base, a, 0, "REJECTED");
    const b = await create(base, 1, 0, 40);
    await resolve(base, b, 1, "CANCELLED");
    assert.deepEqual(await nets(base), [100, -100, 0, 0]);
    await call(
      "post",
      base + "/expense-settlements",
      1,
      { toUserId: users[0], amount: 101, currencyCode: "INR" },
      422,
    );
    await call(
      "post",
      base + "/expense-settlements",
      1,
      { toUserId: users[0], amount: 1, currencyCode: "USD" },
      422,
    );
    console.log(
      "Reject/cancel unchanged balances; excess amount and wrong currency rejected PASS",
    );
  }

  {
    const base = await newTrip();
    await expense(base, 0, 200, [0, 1]);
    await expense(base, 2, 200, [2, 3]);
    const a = await create(base, 1, 0, 100);
    await call(
      "post",
      base + "/expense-settlements",
      1,
      { toUserId: users[2], amount: 1, currencyCode: "INR" },
      422,
    );
    await call(
      "post",
      base + "/expense-settlements",
      3,
      { toUserId: users[0], amount: 1, currencyCode: "INR" },
      422,
    );
    await resolve(base, a, 1, "CANCELLED");
    const b = await create(base, 1, 2, 100);
    await resolve(base, b, 2, "REJECTED");
    const c = await create(base, 1, 0, 100);
    await resolve(base, c, 0, "CONFIRMED");
    const d = await create(base, 3, 2, 100);
    await resolve(base, d, 2, "CONFIRMED");
    assert.deepEqual(await nets(base), [0, 0, 0, 0]);
    console.log(
      "Reservations span counterparties; cancellation/rejection release capacity PASS",
    );
  }
  {
    const base = await newTrip();
    const e = await expense(base, 0, 200, [0, 1]);
    const a = await create(base, 1, 0, 60),
      b = await create(base, 1, 0, 40);
    await call("put", base + "/expenses/" + e.id + "/splits", 0, {
      amount: 100,
      splitType: "EQUAL",
      participants: [{ userId: users[0] }, { userId: users[1] }],
    });
    await resolve(base, a, 0, "CONFIRMED", 422);
    await resolve(base, b, 0, "CONFIRMED", 422);
    await resolve(base, a, 1, "CANCELLED");
    await resolve(base, b, 0, "CONFIRMED");
    assert.deepEqual(await nets(base), [10, -10, 0, 0]);
    const last = await create(base, 1, 0, 10);
    await call("delete", base + "/expenses/" + e.id, 0);
    await resolve(base, last, 0, "CONFIRMED", 422);
    await resolve(base, last, 0, "REJECTED");
    console.log(
      "Split edit and deletion revalidated; other pending reservations retained PASS",
    );
  }
  {
    const base = await newTrip();
    await expense(base, 0, 200, [0, 1]);
    const pending = await create(base, 1, 0, 100);
    // Simulate a duplicate left by the old implementation before deployment.
    const tripId = (
      await client.query("SELECT id FROM trip.trips WHERE itinerary_id=$1", [
        base.split("/").at(-1),
      ])
    ).rows[0].id;
    const legacy = (
      await client.query(
        `
      INSERT INTO trip.trip_expense_settlements
        (trip_id,from_user_id,to_user_id,amount,currency_code,created_by)
      VALUES($1,$2,$3,100,'INR',$2) RETURNING id
    `,
        [tripId, users[1], users[0]],
      )
    ).rows[0];
    await resolve(base, pending, 0, "CONFIRMED", 422);
    await resolve(base, legacy, 0, "CONFIRMED", 422);
    await resolve(base, legacy, 1, "CANCELLED");
    await resolve(base, pending, 0, "CONFIRMED");
    assert.deepEqual(await nets(base), [0, 0, 0, 0]);
    console.log(
      "Legacy duplicate reservations fail safely until one is cancelled PASS",
    );
  }
  {
    const base = await newTrip();
    await expense(base, 0, 200, [0, 1]);
    await call(
      "post",
      base + "/expenses",
      0,
      {
        paidBy: users[0],
        category: "FOOD",
        title: "Independent currency",
        amount: 200,
        currencyCode: "USD",
        paymentMethod: "CASH",
        expenseDate: "2026-09-15",
        splitType: "EQUAL",
        participants: [{ userId: users[0] }, { userId: users[1] }],
      },
      201,
    );
    const inr = await create(base, 1, 0, 100);
    const usd = (
      await call(
        "post",
        base + "/expense-settlements",
        1,
        { toUserId: users[0], amount: 100, currencyCode: "USD" },
        201,
      )
    ).settlement;
    await resolve(base, inr, 0, "CONFIRMED");
    await resolve(base, usd, 0, "CONFIRMED");
    const result = await call("get", base + "/expense-balances", 0);
    assert.equal(result.balances.length, 4);
    assert(result.balances.every((b) => b.netAmount === 0));
    console.log(
      "Same users may reserve and settle independent INR/USD balances PASS",
    );
  }
  {
    const base = await newTrip(3);
    await expense(base, 0, 0.1, [0, 1, 2]);
    for (const actor of [1, 2]) {
      const s = await create(base, actor, 0, 0.03);
      await resolve(base, s, 0, "CONFIRMED");
    }
    assert.deepEqual(await nets(base), [0, 0, 0, 0]);
    console.log(
      "Fractional-cent allocation rounds to cents; settlement arithmetic remains exact PASS",
    );
  }
  console.log("TOTAL HTTP checks", checks);
} finally {
  await client.query("ROLLBACK");
  db.query = query;
  db.transaction = transaction;
  client.release();
  await db.pool.end();
  redis.disconnect();
  console.log("All database fixtures ROLLED BACK.");
}

process.exit(0);
