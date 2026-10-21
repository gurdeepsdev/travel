import { jest } from "@jest/globals";
import pg from "pg";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { userInfo } from "node:os";
import { randomUUID } from "node:crypto";

const enabled = process.env.RUN_PLACE_REVIEW_DB_TESTS === "1";
let directory, pool, owner, member, itineraryId;
const database = {
  query: (...args) => pool.query(...args),
  transaction: async (callback) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
jest.unstable_mockModule("../../../src/database/database-manager.js", () => ({
  default: database,
}));
const { default: repository } =
  await import("../../../src/modules/itinerary/itinerary-change-requests.repository.js");
const baseDays = () =>
  Array.from({ length: 9 }, (_, d) => ({
    day: d + 1,
    label: `Day ${d + 1}`,
    items: Array.from({ length: d === 8 ? 10 : 7 }, (_, i) => ({
      item_type: "poi",
      place_id: `old-${d + 1}-${i}`,
      name: `Original ${d + 1}/${i}`,
      start_time: "09:00",
      end_time: "10:00",
    })),
  }));
const replacement = (day, index) => ({
  day,
  originalPlaceId: `old-${day}-${index}`,
  replacement: {
    item_type: "poi",
    place_id: `new-${day}-${index}`,
    name: `New ${day}/${index}`,
  },
});
const create = (changes) =>
  repository.create({ itineraryId, userId: member, proposedData: { changes } });
const review = (request, decision, changeIds) =>
  repository.review({
    itineraryId,
    userId: owner,
    requestId: request.id,
    decision,
    changeIds,
  });
const itinerary = async () =>
  (
    await pool.query(
      "SELECT itinerary_json FROM itinerary.itineraries WHERE id=$1",
      [itineraryId],
    )
  ).rows[0].itinerary_json;

(enabled ? describe : describe.skip)(
  "targeted place reviews on isolated PostgreSQL",
  () => {
    beforeAll(async () => {
      directory = mkdtempSync("/tmp/artictern-place-review-");
      execFileSync(
        "initdb",
        [
          "-D",
          `${directory}/data`,
          "--auth=trust",
          "--no-locale",
          "--encoding=UTF8",
        ],
        { stdio: "pipe" },
      );
      execFileSync(
        "pg_ctl",
        [
          "-D",
          `${directory}/data`,
          "-l",
          `${directory}/postgres.log`,
          "-o",
          `-k ${directory} -h ''`,
          "-w",
          "start",
        ],
        { stdio: "pipe" },
      );
      pool = new pg.Pool({
        host: directory,
        user: userInfo().username,
        database: "postgres",
      });
      await pool.query(`CREATE SCHEMA itinerary; CREATE SCHEMA groups; CREATE SCHEMA users; CREATE SCHEMA chat;
      CREATE TABLE itinerary.itineraries(id uuid PRIMARY KEY,created_by uuid,itinerary_json jsonb,duration_days int,deleted_at timestamp,updated_at timestamp DEFAULT clock_timestamp());
      CREATE TABLE itinerary.user_itinerary_states(itinerary_id uuid,user_id uuid,status text);
      CREATE TABLE groups.groups(id uuid PRIMARY KEY,itinerary_id uuid,status text,deleted_at timestamp);
      CREATE TABLE groups.group_members(id uuid DEFAULT gen_random_uuid(),group_id uuid,user_id uuid,status text);
      CREATE TABLE users.profiles(user_id uuid,username text,display_name text,deleted_at timestamp);
      CREATE TABLE itinerary.itinerary_change_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),itinerary_id uuid,requested_by uuid,request_type text,proposed_data jsonb,message text,status text DEFAULT 'PENDING',base_itinerary_updated_at timestamp,base_days jsonb,reviewed_by uuid,reviewed_at timestamp,review_message text,created_at timestamp DEFAULT clock_timestamp(),updated_at timestamp DEFAULT clock_timestamp());
      CREATE TABLE chat.conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid UNIQUE,conversation_type text,request_status text,last_message_id uuid,updated_at timestamp);
      CREATE TABLE chat.chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid,sent_by uuid,message_type text,message_content text,itinerary_id uuid,change_request_id uuid,change_request_status text,change_request_changes jsonb);
      CREATE UNIQUE INDEX uq_chat_change_request_notice ON chat.chat_messages(conversation_id,change_request_id,change_request_status) WHERE change_request_id IS NOT NULL;
      CREATE TABLE chat.event_outbox(conversation_id uuid,message_id uuid,event_type text);`);
      await pool.query(
        readFileSync(
          new URL(
            "../../../src/database/migrations/089_targeted_itinerary_place_reviews.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
    }, 30000);
    afterAll(async () => {
      await pool?.end();
      if (directory) {
        try {
          execFileSync(
            "pg_ctl",
            ["-D", `${directory}/data`, "-m", "fast", "-w", "stop"],
            { stdio: "pipe" },
          );
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      }
    });
    beforeEach(async () => {
      owner = randomUUID();
      member = randomUUID();
      itineraryId = randomUUID();
      const groupId = randomUUID();
      await pool.query(
        "INSERT INTO itinerary.itineraries(id,created_by,itinerary_json,duration_days) VALUES($1,$2,$3,9)",
        [
          itineraryId,
          owner,
          {
            days: baseDays(),
            summary: { num_days: 9, total_places: 66 },
            title: "Preserved",
          },
        ],
      );
      await pool.query(
        "INSERT INTO groups.groups VALUES($1,$2,'ACTIVE',null)",
        [groupId, itineraryId],
      );
      await pool.query(
        "INSERT INTO groups.group_members(group_id,user_id,status) VALUES($1,$2,'ACTIVE')",
        [groupId, member],
      );
    });
    test("one explicit replacement preserves all 9 days, 66 places and unrelated metadata", async () => {
      const request = await create([replacement(1, 0)]);
      await review(request, "ACCEPTED");
      const current = await itinerary();
      expect(current.days).toHaveLength(9);
      expect(current.summary).toEqual({ num_days: 9, total_places: 66 });
      expect(current.title).toBe("Preserved");
      expect(current.days[0].items[0]).toMatchObject({
        place_id: "new-1-0",
        start_time: "09:00",
      });
      expect(current.days.slice(1)).toEqual(baseDays().slice(1));
    });
    test("accept one, reject one and leave a third pending; repeated review cannot overwrite a decision", async () => {
      const request = await create([
        replacement(1, 0),
        replacement(1, 1),
        replacement(2, 0),
      ]);
      const [a, b, c] = request.place_changes;
      expect((await review(request, "ACCEPTED", [a.id])).request.status).toBe(
        "PENDING",
      );
      const rejected = await review(request, "REJECTED", [b.id]);
      expect(rejected.request.status).toBe("PENDING");
      expect(rejected.request.place_changes.map((c) => c.status)).toEqual([
        "ACCEPTED",
        "REJECTED",
        "PENDING",
      ]);
      await expect(review(request, "ACCEPTED", [b.id])).rejects.toMatchObject({
        statusCode: 409,
      });
      const current = await itinerary();
      expect(current.days[0].items[1].place_id).toBe("old-1-1");
      expect(current.days[1].items[0].place_id).toBe("old-2-0");
      expect((await review(request, "ACCEPTED", [c.id])).request.status).toBe(
        "ACCEPTED",
      );
      const { rows } = await pool.query(
        "SELECT change_request_status,change_request_changes FROM chat.chat_messages WHERE change_request_id=$1",
        [request.id],
      );
      expect(rows).toHaveLength(4);
      expect(
        rows.filter((r) => r.change_request_status === "ACCEPTED"),
      ).toHaveLength(2);
    });
    test("unrelated pending request remains pending and can still be accepted", async () => {
      const first = await create([replacement(1, 0)]),
        second = await create([replacement(2, 0)]);
      await review(first, "ACCEPTED");
      expect(
        (
          await pool.query(
            "SELECT status FROM itinerary.itinerary_change_requests WHERE id=$1",
            [second.id],
          )
        ).rows[0].status,
      ).toBe("PENDING");
      await review(second, "ACCEPTED");
      expect((await itinerary()).days[0].items[0].place_id).toBe("new-1-0");
    });
    test("concurrent conflicting approvals serialize; loser is stale without changing the itinerary", async () => {
      const first = await create([replacement(1, 0)]),
        second = await create([replacement(1, 0)]);
      const results = await Promise.allSettled([
        review(first, "ACCEPTED"),
        review(second, "ACCEPTED"),
      ]);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
      expect(results.filter((r) => r.value.unavailable)).toHaveLength(1);
      const { rows } = await pool.query(
        "SELECT status FROM itinerary.itinerary_change_requests WHERE id=ANY($1::uuid[])",
        [[first.id, second.id]],
      );
      expect(rows.map((r) => r.status).sort()).toEqual(["ACCEPTED", "STALE"]);
    });
    test("only competing entries become stale; unrelated entries remain reviewable", async () => {
      const first = await create([replacement(1, 0)]);
      const second = await create([replacement(1, 0), replacement(2, 0)]);
      await review(first, "ACCEPTED");
      const { rows: [stored] } = await pool.query(
        'SELECT * FROM itinerary.itinerary_change_requests WHERE id=$1', [second.id]);
      expect(stored.status).toBe("PENDING");
      expect(stored.place_changes.map((c) => c.status)).toEqual(["STALE", "PENDING"]);
      expect(stored.reviewed_by).toBeNull();
      const {rows: notices} = await pool.query(
        "SELECT message_content FROM chat.chat_messages WHERE change_request_id=$1 AND change_request_status='STALE'", [second.id]);
      expect(notices).toHaveLength(1);
      expect(notices[0].message_content).toContain("outdated");
      expect((await review(second, "ACCEPTED")).request.status).toBe("ACCEPTED");
      expect((await itinerary()).days[1].items[0].place_id).toBe("new-2-0");
    });
    test("rejection does not stale competitors; identical place on another day is unaffected", async () => {
      const days = baseDays();
      days[1].items[0].place_id = "old-1-0";
      await pool.query('UPDATE itinerary.itineraries SET itinerary_json=$2 WHERE id=$1',
        [itineraryId, {days, summary: {num_days:9,total_places:66}}]);
      const first = await create([replacement(1, 0)]);
      const competing = await create([replacement(1, 0)]);
      const otherDay = await create([{...replacement(2, 0), originalPlaceId:"old-1-0"}]);
      await review(first, "REJECTED");
      expect((await pool.query('SELECT status FROM itinerary.itinerary_change_requests WHERE id=$1', [competing.id])).rows[0].status).toBe("PENDING");
      await review(competing, "ACCEPTED");
      expect((await pool.query('SELECT status FROM itinerary.itinerary_change_requests WHERE id=$1', [otherDay.id])).rows[0].status).toBe("PENDING");
      await review(otherDay, "ACCEPTED");
    });
    test("ambiguous partial payload is rejected atomically; no request or notice is saved", async () => {
      await expect(
        repository.create({
          itineraryId,
          userId: member,
          proposedData: {
            days: [{ day: 1, items: [replacement(1, 0).replacement] }],
          },
        }),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(
        (
          await pool.query(
            "SELECT count(*) FROM itinerary.itinerary_change_requests WHERE itinerary_id=$1",
            [itineraryId],
          )
        ).rows[0].count,
      ).toBe("0");
      expect((await itinerary()).days).toEqual(baseDays());
    });
    test("legacy complete day snapshot changes only its POI and never deletes omitted days", async () => {
      const day = baseDays()[0];
      day.items[0] = { ...day.items[0], ...replacement(1, 0).replacement };
      const request = await repository.create({
        itineraryId,
        userId: member,
        proposedData: { days: [day], totalPlaces: 7 },
      });
      await review(request, "ACCEPTED");
      expect((await itinerary()).days).toHaveLength(9);
    });

  test('stored legacy one-item proposal cannot replace a 66-place itinerary',async()=>{
    const {rows:[request]}=await pool.query(`INSERT INTO itinerary.itinerary_change_requests
      (itinerary_id,requested_by,request_type,proposed_data,base_days,base_itinerary_updated_at)
      SELECT id,$2,'UPDATE_ITINERARY',$3,$4,updated_at FROM itinerary.itineraries WHERE id=$1 RETURNING *`,
      [itineraryId,member,{days:[{day:1,items:[replacement(1,0).replacement]}],totalPlaces:1},JSON.stringify(baseDays())]);
    await expect(review(request,'ACCEPTED')).rejects.toMatchObject({statusCode:422});
    expect((await itinerary()).days).toEqual(baseDays());
    expect((await pool.query('SELECT status FROM itinerary.itinerary_change_requests WHERE id=$1',[request.id])).rows[0].status).toBe('PENDING');
    expect((await review(request,'REJECTED')).request.status).toBe('REJECTED');
  });

  test('notice failure rolls back itinerary and per-change decisions together',async()=>{
    const request=await create([replacement(1,0)]);
    const competitor=await create([replacement(1,0)]);
    await pool.query(`CREATE FUNCTION chat.fail_test_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test outbox failure'; END $$;
      CREATE TRIGGER fail_test_outbox BEFORE INSERT ON chat.event_outbox FOR EACH ROW EXECUTE FUNCTION chat.fail_test_outbox();`);
    try{
      await expect(review(request,'ACCEPTED')).rejects.toThrow('test outbox failure');
      expect((await itinerary()).days).toEqual(baseDays());
      const {rows:[stored]}=await pool.query('SELECT status,place_changes FROM itinerary.itinerary_change_requests WHERE id=$1',[request.id]);
      expect(stored.status).toBe('PENDING');expect(stored.place_changes[0].status).toBe('PENDING');
      const {rows:[competing]}=await pool.query('SELECT status,place_changes FROM itinerary.itinerary_change_requests WHERE id=$1',[competitor.id]);
      expect(competing.status).toBe('PENDING');expect(competing.place_changes[0].status).toBe('PENDING');
      expect((await pool.query("SELECT id FROM chat.chat_messages WHERE change_request_id=$1 AND change_request_status='STALE'",[competitor.id])).rows).toHaveLength(0);
    }finally{await pool.query('DROP TRIGGER fail_test_outbox ON chat.event_outbox; DROP FUNCTION chat.fail_test_outbox();');}
  });
    test("non-owner cannot review and removed requester cannot have changes accepted", async () => {
      const request = await create([replacement(1, 0)]);
      expect(
        await repository.review({
          itineraryId,
          requestId: request.id,
          userId: member,
          decision: "ACCEPTED",
        }),
      ).toBeNull();
      await pool.query(
        "UPDATE groups.group_members SET status='REMOVED' WHERE user_id=$1",
        [member],
      );
      expect(await review(request, "ACCEPTED")).toMatchObject({
        unavailable: true,
      });
      expect((await review(request, "REJECTED")).request.status).toBe(
        "REJECTED",
      );
    });
  },
);
