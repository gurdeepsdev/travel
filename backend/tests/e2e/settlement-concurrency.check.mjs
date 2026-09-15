import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import db from "../../src/database/database-manager.js";
import env from "../../src/config/env.js";
import jwt from "../../src/core/security/jwt.js";
import redis from "../../src/config/redis.js";
import app from "../../src/app.js";
import { lockExpenseTrip } from "../../src/modules/itinerary/expense-write-lock.js";

assert(["development", "test"].includes(env.NODE_ENV));
assert(["localhost", "127.0.0.1", "::1"].includes(env.DB_HOST));
// Committed, uniquely identified local fixtures let separate pool connections race.
// Cleanup removes only these fixtures. Never run this against a remote database.
const users = Array.from({ length: 4 }, () => randomUUID()),
  tokens = [];
let groupId,
  itineraryId,
  tripId,
  checks = 0;
const send = (method, path, actor, body) => {
  const req = request(app)
    [method]("/api/v1" + path)
    .set("Authorization", "Bearer " + tokens[actor]);
  return body === undefined ? req : req.send(body);
};
const call = async (method, path, actor, body, status = 200) => {
  const res = await send(method, path, actor, body);
  assert.equal(res.status, status, JSON.stringify(res.body));
  checks++;
  return res.body.data;
};
try {
  await db.transaction(async (client) => {
    for (const id of users) {
      const sid = randomUUID();
      await client.query(
        "INSERT INTO auth.users(id,status) VALUES($1,'ACTIVE')",
        [id],
      );
      await client.query(
        "INSERT INTO users.profiles(user_id,username) VALUES($1,$2)",
        [id, "race_" + id.replaceAll("-", "")],
      );
      await client.query(
        "INSERT INTO auth.sessions(id,user_id,refresh_token_hash,expires_at) VALUES($1,$2,'fixture',$3)",
        [sid, id, new Date(Date.now() + 86400000)],
      );
      tokens.push(jwt.generateAccessToken({ sub: id, sid, ver: 1 }));
    }
    for (const id of users.slice(1))
      await client.query(
        "INSERT INTO users.connections(user_low_id,user_high_id) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid))",
        [users[0], id],
      );
  });
  groupId = (
    await call("post", "/groups", 0, {
      name: "Isolated settlement concurrency test",
    })
  ).group.id;
  for (let actor = 1; actor < 4; actor++) {
    const invite = (
      await call("post", `/groups/${groupId}/invitations`, 0, {
        userId: users[actor],
      })
    ).invitation;
    await call("patch", `/users/me/group-invitations/${invite.id}`, actor, {
      status: "ACCEPTED",
    });
  }
  const payload = {
    request_id: randomUUID(),
    status: "success",
    mode: "future",
    city_id: "delhi",
    summary: { num_days: 1, total_places: 1 },
    days: [{ day: 1, items: [{ item_type: "poi", place_id: "test-place" }] }],
  };
  itineraryId = (await call("post", "/itineraries", 0, payload, 201)).itinerary
    .id;
  const base = "/itineraries/" + itineraryId;
  await call("put", `/groups/${groupId}/itinerary`, 0, { itineraryId });
  tripId = (
    await db.query("SELECT id FROM trip.trips WHERE itinerary_id=$1", [
      itineraryId,
    ])
  ).rows[0].id;
  const expense = async (paidBy, actors) =>
    (
      await call(
        "post",
        base + "/expenses",
        paidBy,
        {
          paidBy: users[paidBy],
          category: "FOOD",
          title: "Race fixture",
          amount: 200,
          currencyCode: "INR",
          paymentMethod: "CASH",
          expenseDate: "2026-09-15",
          splitType: "EQUAL",
          participants: actors.map((a) => ({ userId: users[a] })),
        },
        201,
      )
    ).expense;
  const first = await expense(0, [0, 1]);
  await expense(3, [2, 3]);
  const input = (to, amount = 100) => ({
    toUserId: users[to],
    amount,
    currencyCode: "INR",
  });
  const race = async (a, b) => {
    const results = await Promise.all([a, b]);
    checks += 2;
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 422]);
    assert.equal(
      results.find((r) => r.status === 422).body.code,
      "ITINERARY.EXPENSE_SETTLEMENT_INVALID",
    );
    const s = results.find((r) => r.status === 201).body.data.settlement;
    const actor = users.indexOf(s.fromUser.id);
    await call("patch", base + "/expense-settlements/" + s.id, actor, {
      status: "CANCELLED",
    });
  };
  await race(
    send("post", base + "/expense-settlements", 1, input(0)),
    send("post", base + "/expense-settlements", 1, input(0)),
  );
  console.log("PASS concurrent duplicate creation: exactly one reserved");
  await race(
    send("post", base + "/expense-settlements", 1, input(0)),
    send("post", base + "/expense-settlements", 1, input(3)),
  );
  console.log("PASS concurrent outgoing reservations to different creditors");
  await race(
    send("post", base + "/expense-settlements", 1, input(0)),
    send("post", base + "/expense-settlements", 2, input(0)),
  );
  console.log("PASS concurrent incoming reservations from different debtors");
  const a = (
    await call("post", base + "/expense-settlements", 1, input(0, 50), 201)
  ).settlement;
  const b = (
    await call("post", base + "/expense-settlements", 1, input(0, 50), 201)
  ).settlement;
  const confirmed = await Promise.all(
    [a, b].map((s) =>
      send("patch", base + "/expense-settlements/" + s.id, 0, {
        status: "CONFIRMED",
      }),
    ),
  );
  checks += 2;
  assert(confirmed.every((r) => r.status === 200));
  console.log("PASS concurrent confirmation of two valid partial reservations");
  const c = (
    await call("post", base + "/expense-settlements", 2, input(3), 201)
  ).settlement;
  const duplicate = await Promise.all(
    [1, 2].map(() =>
      send("patch", base + "/expense-settlements/" + c.id, 3, {
        status: "CONFIRMED",
      }),
    ),
  );
  checks += 2;
  assert.deepEqual(duplicate.map((r) => r.status).sort(), [200, 404]);
  assert(
    (await call("get", base + "/expense-balances", 0)).balances.every(
      (b) => b.netAmount === 0,
    ),
  );
  console.log(
    "PASS concurrent confirmation retry counted only once; all four balances zero",
  );
  // New debt after full settlement, then force confirmation to wait behind an edit.
  const fresh = await expense(0, [0, 1]);
  const stale = (
    await call("post", base + "/expense-settlements", 1, input(0), 201)
  ).settlement;
  const blocker = await db.getClient();
  let pending;
  try {
    await blocker.query("BEGIN");
    await lockExpenseTrip(blocker, tripId);
    pending = send("patch", base + "/expense-settlements/" + stale.id, 0, {
      status: "CONFIRMED",
    }).then((r) => r);
    const pid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      waiting = (
        await db.query(
          "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1::int=ANY(pg_blocking_pids(pid))) AS waiting",
          [pid],
        )
      ).rows[0].waiting;
      if (waiting) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert(waiting, "Confirmation must actually wait for the ledger lock");
    await blocker.query(
      "UPDATE trip.trip_expenses SET deleted_at=CURRENT_TIMESTAMP WHERE id=$1",
      [fresh.id],
    );
    await blocker.query("COMMIT");
    const result = await pending;
    checks++;
    assert.equal(result.status, 422, JSON.stringify(result.body));
    assert(
      (await call("get", base + "/expense-balances", 0)).balances.every(
        (b) => b.netAmount === 0,
      ),
    );
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
  await call("patch", base + "/expense-settlements/" + stale.id, 1, {
    status: "CANCELLED",
  });
  assert(first.id);
  console.log(
    "PASS confirmation rechecks balance after waiting for ledger lock",
  );
  console.log("TOTAL concurrency HTTP checks", checks);
} finally {
  await db.transaction(async (client) => {
    if (tripId)
      await client.query("DELETE FROM trip.trips WHERE id=$1", [tripId]);
    if (groupId)
      await client.query("DELETE FROM groups.groups WHERE id=$1", [groupId]);
    if (itineraryId)
      await client.query("DELETE FROM itinerary.itineraries WHERE id=$1", [
        itineraryId,
      ]);
    await client.query(
      "DELETE FROM users.connections WHERE user_low_id=ANY($1::uuid[]) OR user_high_id=ANY($1::uuid[])",
      [users],
    );
    await client.query(
      "DELETE FROM auth.sessions WHERE user_id=ANY($1::uuid[])",
      [users],
    );
    await client.query(
      "DELETE FROM users.profiles WHERE user_id=ANY($1::uuid[])",
      [users],
    );
    await client.query("DELETE FROM auth.users WHERE id=ANY($1::uuid[])", [
      users,
    ]);
  });
  const remaining = (
    await db.query(
      "SELECT COUNT(*)::int AS n FROM auth.users WHERE id=ANY($1::uuid[])",
      [users],
    )
  ).rows[0].n;
  assert.equal(remaining, 0);
  await db.pool.end();
  redis.disconnect();
  console.log("Committed local race fixtures removed and cleanup verified.");
}
process.exit(0);
