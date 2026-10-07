import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import pg from "pg";
import jwt from "jsonwebtoken";
import { io as connect } from "socket.io-client";
import env from "../../src/config/env.js";

if (
  !["localhost", "127.0.0.1"].includes(env.DB_HOST) ||
  !env.DB_NAME.endsWith("_dev")
)
  throw Error("Local _dev database required.");
const sourceDatabase = env.DB_NAME;
const testDatabase = `chat_load_${randomUUID().replaceAll("-", "")}_dev`;
if (!/^chat_load_[a-f0-9]{32}_dev$/.test(testDatabase))
  throw Error("Invalid isolated database name.");
const admin = new pg.Client({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: sourceDatabase,
});
env.DB_NAME = testDatabase;
process.env.CHAT_PUSH_ENABLED = "false";
const report = {
  scope:
    "Isolated local production chat routes, real JWT/session auth, PostgreSQL pool and Socket.IO Redis adapter. Not VPS/network/device capacity.",
  startedAt: new Date().toISOString(),
  stages: [],
  errors: [],
  connections: [],
  delivery: { duplicates: 0, unexpected: 0, missing: 0 },
};
let db,
  redis,
  server,
  realtime,
  created = false,
  timer;
const sockets = [],
  seen = new Map(),
  received = new Map(),
  sent = new Map(),
  deliveryLatencies = [];
let workerBusy = false,
  workerFailures = 0;
const infrastructureErrors = [];
const captureRejection = (error) => {
  infrastructureErrors.push(
    String(error?.message ?? "Unhandled rejection").slice(0, 120),
  );
};
process.on("unhandledRejection", captureRejection);
const metrics = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p) =>
    sorted.length
      ? +sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)].toFixed(2)
      : null;
  return {
    count: sorted.length,
    p50Ms: pct(0.5),
    p95Ms: pct(0.95),
    p99Ms: pct(0.99),
    maxMs: pct(1),
  };
};
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${testDatabase}"`);
  created = true;
  const schema = execFileSync(
    "docker",
    [
      "exec",
      "artictern-dev-postgres",
      "pg_dump",
      "-U",
      env.DB_USER,
      "-d",
      sourceDatabase,
      "--schema-only",
      "--no-owner",
      "--no-privileges",
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "artictern-dev-postgres",
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      env.DB_USER,
      "-d",
      testDatabase,
    ],
    { input: schema, stdio: ["pipe", "ignore", "pipe"] },
  );
  ({ default: db } = await import("../../src/database/database-manager.js"));
  for (const migration of [
    "075_chat_conversation_access.sql",
    "076_chat_message_lifecycle.sql",
    "077_chat_inbox_notifications.sql",
    "078_chat_event_replay.sql",
    "079_chat_conversation_event_sequence.sql",
  ]) {
    await db.query(
      readFileSync(
        new URL(`../../src/database/migrations/${migration}`, import.meta.url),
        "utf8",
      ),
    );
  }
  const { rows: users } = await db.query(
    "INSERT INTO auth.users(status) SELECT 'ACTIVE' FROM generate_series(1,100) RETURNING id",
  );
  for (const user of users) {
    const {
      rows: [session],
    } = await db.query(
      "INSERT INTO auth.sessions(user_id,refresh_token_hash,expires_at) VALUES($1,$2,$3) RETURNING id",
      [user.id, randomUUID(), new Date(Date.now() + 3600000)],
    );
    user.token = jwt.sign(
      { sub: user.id, sid: session.id, type: "access" },
      env.JWT_ACCESS_SECRET,
      { algorithm: "HS256", expiresIn: "1h" },
    );
  }
  const {
    rows: [group],
  } = await db.query(
    "INSERT INTO groups.groups(owner_id,name) VALUES($1,'Isolated chat load') RETURNING id",
    [users[0].id],
  );
  await db.query(
    "INSERT INTO groups.group_members(group_id,user_id,role,status,added_by) SELECT $1,id,'MEMBER','ACTIVE',$3 FROM unnest($2::uuid[]) id",
    [group.id, users.slice(1).map((u) => u.id), users[0].id],
  );
  const { default: repository } =
    await import("../../src/modules/chat/chat.repository.js");
  const conversation = await repository.create(users[0].id, {
    type: "group",
    groupId: group.id,
  });
  const { default: routes } =
    await import("../../src/modules/chat/chat.routes.js");
  ({ default: redis } = await import("../../src/config/redis.js"));
  const { AuthContextService } =
    await import("../../src/modules/auth/services/index.js");
  await AuthContextService.authenticate(users[0].token);
  const app = express();
  app.use(express.json());
  app.use("/api/v1/chat", routes);
  app.use((error, _req, res, _next) =>
    res
      .status(error.statusCode ?? 500)
      .json({ success: false, code: error.code ?? "INTERNAL" }),
  );
  server = createServer(app);
  const { initializeRealtimeServer } =
    await import("../../src/realtime/realtime-server.js");
  realtime = initializeRealtimeServer(server);
  ({ default: redis } = await import("../../src/config/redis.js"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (let offset = 0; offset < users.length; offset += 10)
    await Promise.all(
      users.slice(offset, offset + 10).map(async (user) => {
        const start = performance.now();
        const socket = connect(base, {
          auth: { token: user.token },
          transports: ["websocket"],
          reconnection: false,
          autoConnect: false,
        });
        sockets.push(socket);
        seen.set(user.id, new Set());
        socket.on("chat.updated", (event) => {
          if (event.type !== "message.created") return;
          if (seen.get(user.id).has(event.eventId)) {
            report.delivery.duplicates++;
            return;
          }
          seen.get(user.id).add(event.eventId);
          if (
            event.conversationId !== conversation.id ||
            !event.replayCursor ||
            !event.conversationSequence
          ) {
            report.delivery.unexpected++;
            return;
          }
          if (!received.has(event.messageId))
            received.set(event.messageId, new Map());
          received.get(event.messageId).set(user.id, Date.now());
        });
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(Error("Socket connection timeout")),
            10000,
          );
          socket.once("connect", () => {
            clearTimeout(timeout);
            resolve();
          });
          socket.once("connect_error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          socket.connect();
        });
        report.connections.push(performance.now() - start);
      }),
    );
  const unauthorized = await fetch(`${base}/api/v1/chat/unread-count`);
  if (unauthorized.status !== 401)
    throw Error("Unauthenticated access was not rejected.");
  const deniedSocket = connect(base, {
    transports: ["websocket"],
    reconnection: false,
    autoConnect: false,
  });
  sockets.push(deniedSocket);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("Unauthenticated socket was not rejected")),
      5000,
    );
    deniedSocket.once("connect", () => {
      clearTimeout(timeout);
      reject(Error("Unauthenticated socket connected"));
    });
    deniedSocket.once("connect_error", () => {
      clearTimeout(timeout);
      resolve();
    });
    deniedSocket.connect();
  });
  deniedSocket.disconnect();
  report.authentication = {
    httpUnauthorizedRejected: true,
    socketUnauthorizedRejected: true,
  };
  const { processChatEvents } =
    await import("../../src/realtime/chat-outbox.worker.js");
  async function pump() {
    if (workerBusy) return;
    workerBusy = true;
    try {
      await processChatEvents();
    } catch {
      workerFailures++;
    } finally {
      workerBusy = false;
    }
  }
  timer = setInterval(pump, 500);
  console.log(
    "Connected 100 authenticated sockets; beginning 4 x 10-second stages.",
  );
  for (const concurrency of [10, 25, 50, 100]) {
    const stage = {
      users: concurrency,
      durationSeconds: 10,
      requests: 0,
      failures: 0,
      latencies: [],
      endpoints: {},
    };
    const start = performance.now(),
      stop = start + 10000;
    await Promise.all(
      users.slice(0, concurrency).map(async (user, index) => {
        let iteration = index;
        while (performance.now() < stop) {
          const slot = iteration++ % 10;
          let endpoint =
            slot < 4
              ? "inbox"
              : slot < 7
                ? "history"
                : slot < 9
                  ? "unread"
                  : "send";
          const path =
            endpoint === "inbox"
              ? "/conversations?limit=30"
              : endpoint === "history"
                ? `/conversations/${conversation.id}/messages?limit=30`
                : endpoint === "unread"
                  ? "/unread-count"
                  : `/conversations/${conversation.id}/messages`;
          const requestStart = performance.now();
          const requestWallClock = Date.now();
          try {
            const response = await fetch(`${base}/api/v1/chat${path}`, {
              method: endpoint === "send" ? "POST" : "GET",
              headers: {
                Authorization: `Bearer ${user.token}`,
                "Content-Type": "application/json",
              },
              body:
                endpoint === "send"
                  ? JSON.stringify({
                      text: "Isolated load test",
                      clientMessageId: randomUUID(),
                    })
                  : undefined,
              signal: AbortSignal.timeout(10000),
            });
            const body = await response.json();
            if (!response.ok || !body.success)
              throw Error(`${response.status}:${body.code ?? "FAILED"}`);
            if (endpoint === "send")
              sent.set(body.data.message.id, requestWallClock);
          } catch (error) {
            stage.failures++;
            if (report.errors.length < 20)
              report.errors.push({
                stage: concurrency,
                endpoint,
                error: String(error.message).slice(0, 120),
              });
          }
          const latency = performance.now() - requestStart;
          stage.latencies.push(latency);
          stage.requests++;
          (stage.endpoints[endpoint] ??= []).push(latency);
          await delay(200);
        }
      }),
    );
    stage.elapsedSeconds = +((performance.now() - start) / 1000).toFixed(2);
    stage.requestsPerSecond = +(stage.requests / stage.elapsedSeconds).toFixed(
      2,
    );
    stage.latency = metrics(stage.latencies);
    delete stage.latencies;
    stage.endpoints = Object.fromEntries(
      Object.entries(stage.endpoints).map(([key, values]) => [
        key,
        metrics(values),
      ]),
    );
    report.stages.push(stage);
    console.log(JSON.stringify(stage));
  }
  const drainUntil = Date.now() + 30000;
  while (Date.now() < drainUntil) {
    await pump();
    const {
      rows: [pending],
    } = await db.query(
      "SELECT COUNT(*)::int AS count FROM chat.event_outbox WHERE processed_at IS NULL",
    );
    if (!pending.count && !workerBusy) break;
    await delay(500);
  }
  await delay(1000);
  const reconnectUser = users[99],
    reconnectSocket = sockets[99];
  const authHeaders = { Authorization: `Bearer ${reconnectUser.token}` };
  const baseline = await fetch(`${base}/api/v1/chat/events`, {
    headers: authHeaders,
  }).then((response) => response.json());
  if (!baseline.success) throw Error("Replay baseline failed");
  reconnectSocket.disconnect();
  await delay(100);
  const probeIds = [];
  for (let index = 0; index < 3; index++) {
    const response = await fetch(
      `${base}/api/v1/chat/conversations/${conversation.id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${users[0].token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "Reconnect probe",
          clientMessageId: randomUUID(),
        }),
      },
    );
    const body = await response.json();
    if (!response.ok || !body.success)
      throw Error("Reconnect probe send failed");
    probeIds.push(body.data.message.id);
  }
  const replayDeadline = Date.now() + 10000;
  while (Date.now() < replayDeadline) {
    await pump();
    if (
      !(
        await db.query(
          "SELECT COUNT(*)::int AS count FROM chat.event_outbox WHERE processed_at IS NULL",
        )
      ).rows[0].count
    )
      break;
    await delay(100);
  }
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("Reconnect timed out")),
      10000,
    );
    reconnectSocket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    reconnectSocket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    reconnectSocket.connect();
  });
  const replay = await fetch(
    `${base}/api/v1/chat/events?after=${baseline.data.nextCursor}`,
    { headers: authHeaders },
  ).then((response) => response.json());
  report.reconnect = {
    probeMessages: 3,
    recovered: replay.success
      ? probeIds.filter((id) =>
          replay.data.events.some((event) => event.messageId === id),
        ).length
      : 0,
  };
  if (report.reconnect.recovered !== 3)
    throw Error("Reconnect replay did not recover all probe messages");
  for (const [id, createdAt] of sent) {
    const recipients = received.get(id) ?? new Map();
    report.delivery.missing += 100 - recipients.size;
    for (const at of recipients.values())
      deliveryLatencies.push(Math.max(0, at - createdAt));
  }
  report.connections = metrics(report.connections);
  report.delivery.messagesSent = sent.size;
  report.delivery.expectedDeliveries = sent.size * 100;
  report.delivery.latency = metrics(deliveryLatencies);
  report.delivery.workerFailures = workerFailures;
  report.delivery.pendingEvents = (
    await db.query(
      "SELECT COUNT(*)::int AS count FROM chat.event_outbox WHERE processed_at IS NULL",
    )
  ).rows[0].count;
  report.memory = {
    rssMB: +(process.memoryUsage().rss / 1024 / 1024).toFixed(2),
  };
  report.finishedAt = new Date().toISOString();
  report.infrastructureErrors = infrastructureErrors;
  report.targets = {
    httpP95Ms: 500,
    httpP99Ms: 1500,
    deliveryP95Ms: 2000,
    note: "Local regression targets, not a production SLA.",
  };
  report.functionalPassed =
    report.stages.every((s) => s.failures === 0) &&
    !report.delivery.missing &&
    !report.delivery.unexpected &&
    !report.delivery.pendingEvents &&
    !infrastructureErrors.length;
  report.performancePassed =
    report.stages.every(
      (s) => s.latency.p95Ms <= 500 && s.latency.p99Ms <= 1500,
    ) && report.delivery.latency.p95Ms <= 2000;
  report.passed = report.functionalPassed && report.performancePassed;
} catch (error) {
  report.fatal = String(error.message).slice(0, 300);
  report.passed = false;
  console.error("Load harness failure:", report.fatal);
} finally {
  clearInterval(timer);
  while (workerBusy) await delay(50);
  for (const socket of sockets) socket.disconnect();
  if (realtime) await new Promise((resolve) => realtime.close(resolve));
  else if (server) await new Promise((resolve) => server.close(resolve));
  if (redis) {
    await delay(5500);
    if (redis.status === "ready") await redis.quit();
    else redis.disconnect();
  }
  if (db) await db.pool.end();
  if (created) {
    await admin.query(`DROP DATABASE "${testDatabase}" WITH (FORCE)`);
    report.isolatedDatabaseRemoved = true;
  }
  await admin.end();
  report.infrastructureErrors = infrastructureErrors;
  report.passed = report.passed && !infrastructureErrors.length;
  writeFileSync(
    new URL("../../reports/chat-load-results.json", import.meta.url),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
process.off("unhandledRejection", captureRejection);
if (!report.passed) process.exitCode = 1;
