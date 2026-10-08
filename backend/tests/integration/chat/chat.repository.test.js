import { jest } from "@jest/globals";
import pg from "pg";
import { readFileSync } from "node:fs";
import env from "../../../src/config/env.js";

let client;
const malwareScan = jest.fn().mockResolvedValue();
jest.unstable_mockModule(
  "../../../src/modules/chat/chat-malware.service.js",
  () => ({ scanChatAttachment: malwareScan }),
);
jest.unstable_mockModule("../../../src/database/database-manager.js", () => ({
  default: {
    transaction: (callback) => callback(client),
    query: (...args) => client.query(...args),
  },
}));
const { default: repository } =
  await import("../../../src/modules/chat/chat.repository.js");
const { default: messages } =
  await import("../../../src/modules/chat/chat-messages.service.js");
const { default: inbox } =
  await import("../../../src/modules/chat/chat-inbox.service.js");
const { default: groupRepository } =
  await import("../../../src/modules/groups/groups.repository.js");
const {
  default: events,
  recordUserEvent,
  recordUserEventBatch,
} = await import("../../../src/modules/chat/chat-events.service.js");
const describeDatabase =
  process.env.RUN_CHAT_DB_TESTS === "1" ? describe : describe.skip;

describeDatabase(
  "Chat conversation repository (rollback-only local database)",
  () => {
    let owner, member, group;
    beforeAll(async () => {
      if (!env.DB_NAME.endsWith("_dev"))
        throw new Error("Chat database tests require a local _dev database.");
      client = new pg.Client({
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
      });
      await client.connect();
      await client.query("BEGIN");
      const migration = readFileSync(
        new URL(
          "../../../src/database/migrations/075_chat_conversation_access.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await client.query(
        migration.replace(/^BEGIN;/m, "").replace(/^COMMIT;/m, ""),
      );
      const messageMigration = readFileSync(
        new URL(
          "../../../src/database/migrations/076_chat_message_lifecycle.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await client.query(
        messageMigration.replace(/^BEGIN;/m, "").replace(/^COMMIT;/m, ""),
      );
      const inboxMigration = readFileSync(
        new URL(
          "../../../src/database/migrations/077_chat_inbox_notifications.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await client.query(
        inboxMigration.replace(/^BEGIN;/m, "").replace(/^COMMIT;/m, ""),
      );
      const replayMigration = readFileSync(
        new URL(
          "../../../src/database/migrations/078_chat_event_replay.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await client.query(
        replayMigration.replace(/^BEGIN;/m, "").replace(/^COMMIT;/m, ""),
      );
      const sequenceMigration = readFileSync(
        new URL(
          "../../../src/database/migrations/079_chat_conversation_event_sequence.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await client.query(
        sequenceMigration.replace(/^BEGIN;/m, "").replace(/^COMMIT;/m, ""),
      );
      const { rows } = await client.query(
        "INSERT INTO auth.users (status) VALUES ('ACTIVE'),('ACTIVE') RETURNING id",
      );
      [owner, member] = rows.map((row) => row.id);
      const result = await client.query(
        "INSERT INTO groups.groups (owner_id,name) VALUES ($1,'Chat test') RETURNING id",
        [owner],
      );
      group = result.rows[0].id;
      await client.query(
        "INSERT INTO groups.group_members (group_id,user_id,role,status,added_by) VALUES ($1,$2,'MEMBER','ACTIVE',$3)",
        [group, member, owner],
      );
    });
    test("inbox adds direct profile, group cover and community icon without changing access", async () => {
      await client.query("SAVEPOINT inbox_display_test");
      try {
        const {rows:[photo]}=await client.query(`INSERT INTO media.assets
          (storage_provider,bucket,storage_key,mime_type,extension,file_size,checksum,uploaded_by,is_public,original_filename)
          VALUES ('local','local','chat/inbox.jpg','image/jpeg','jpg',10,$1,$2,true,'inbox.jpg') RETURNING id`,[crypto.randomUUID(),member]);
        const username=`chat_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`;
        await client.query("INSERT INTO users.profiles (user_id,username,display_name,profile_photo_asset_id) VALUES ($1,$2,'Chat peer',$3)",[member,username,photo.id]);
        const direct=await repository.create(owner,{type:"direct",userId:member});
        const grouped=await repository.create(owner,{type:"group",groupId:group});
        await client.query("UPDATE groups.groups SET cover_asset_id=$1 WHERE id=$2",[photo.id,group]);
        const {rows:[community]}=await client.query("INSERT INTO community.communities (owner_id,name,icon_asset_id) VALUES ($1,'Community display',$2) RETURNING id",[owner,photo.id]);
        const communal=await repository.create(owner,{type:"community",communityId:community.id});
        const list=async()=> (await inbox.list(owner,{limit:30,archived:false})).conversations;
        const image={id:photo.id,url:`/api/v1/media/assets/${photo.id}/content`,mimeType:"image/jpeg"};
        const rows=await list();
        expect(rows.find(c=>c.id===direct.id)).toMatchObject({conversationId:direct.id,name:"Chat peer",image,otherUser:{id:member,username,displayName:"Chat peer",profilePhoto:image}});
        expect(rows.find(c=>c.id===grouped.id)).toMatchObject({conversationId:grouped.id,name:"Chat test",image,otherUser:null});
        expect(rows.find(c=>c.id===communal.id)).toMatchObject({name:"Community display",image,otherUser:null});
        await client.query("UPDATE users.profiles SET display_name=NULL WHERE user_id=$1",[member]);
        expect((await list()).find(c=>c.id===direct.id).name).toBe(username);
        await client.query("UPDATE media.assets SET deleted_at=NOW() WHERE id=$1",[photo.id]);
        expect((await list()).every(c=>c.image===null)).toBe(true);
        await client.query("UPDATE users.profiles SET deleted_at=NOW() WHERE user_id=$1",[member]);
        expect((await list()).find(c=>c.id===direct.id)).toMatchObject({name:null,otherUser:{id:member,username:null,displayName:null,profilePhoto:null}});
        await client.query("INSERT INTO users.blocked_users(user_id,blocked_user_id) VALUES ($1,$2)",[owner,member]);
        expect((await list()).some(c=>c.id===direct.id)).toBe(false);
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT inbox_display_test");
        await client.query("RELEASE SAVEPOINT inbox_display_test");
      }
    });
    test("group list counts unread text and attachment messages using personal read state", async () => {
      await client.query("SAVEPOINT group_unread_test");
      try {
        const find = async (userId) => (await groupRepository.listMyGroups({userId,limit:20})).find(row => row.id===group);
        expect(await find(member)).toMatchObject({conversation_id:null,unread_count:0});
        const conversation=await repository.create(owner,{type:"group",groupId:group});
        const sent=[];
        for(let i=0;i<5;i++) sent.push((await messages.send(owner,conversation.id,{text:`Unread ${i}`,clientMessageId:crypto.randomUUID()})).message);
        await client.query("UPDATE chat.chat_messages SET message_type='DOCUMENT' WHERE id=$1",[sent[0].id]);
        expect(await find(member)).toMatchObject({conversation_id:conversation.id,unread_count:5});
        expect((await find(owner)).unread_count).toBe(0);
        await messages.receipt(member,conversation.id,sent[0].id,"READ");
        expect((await find(member)).unread_count).toBe(4);
        await messages.mutate(member,conversation.id,sent[1].id,"hide",{});
        expect((await find(member)).unread_count).toBe(3);
        await messages.mutate(owner,conversation.id,sent[2].id,"delete",{});
        expect((await find(member)).unread_count).toBe(2);
        const newest=(await messages.history(member,conversation.id,{limit:1})).messages[0];
        await inbox.read(member,conversation.id,newest.id);
        expect((await find(member)).unread_count).toBe(0);
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT group_unread_test");
        await client.query("RELEASE SAVEPOINT group_unread_test");
      }
    });
    test("history includes sender profile and nullable photo without changing send responses", async () => {
      const conversation = await repository.create(owner, { type: "group", groupId: group });
      await client.query("SAVEPOINT sender_profile_test");
      try {
        await client.query(
          "INSERT INTO users.profiles (user_id,username,display_name) VALUES ($1,$2,'Sender test')",
          [owner, `chat_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`],
        );
        const sent = await messages.send(owner, conversation.id, { text: "Sender details", clientMessageId: crypto.randomUUID() });
        expect(sent.message).not.toHaveProperty("sender");
        let history = await messages.history(member, conversation.id, { limit: 1 });
        expect(history.messages[0].sender).toMatchObject({ id: owner, displayName: "Sender test", profilePhoto: null });
        expect(history.messages[0].sender.username).toMatch(/^chat_/);
        expect(history.messages[0].senderId).toBe(owner);
        const { rows: [photo] } = await client.query(
          `INSERT INTO media.assets (storage_provider,bucket,storage_key,mime_type,extension,file_size,checksum,uploaded_by,is_public,original_filename)
           VALUES ('local','local','chat/sender.jpg','image/jpeg','jpg',10,$1,$2,true,'sender.jpg') RETURNING id`,
          [crypto.randomUUID(), owner],
        );
        await client.query("UPDATE users.profiles SET profile_photo_asset_id=$1 WHERE user_id=$2", [photo.id, owner]);
        history = await messages.history(member, conversation.id, { limit: 1 });
        expect(history.messages[0].sender.profilePhoto).toEqual({ id: photo.id, url: `/api/v1/media/assets/${photo.id}/content`, mimeType: "image/jpeg" });
        await client.query("UPDATE media.assets SET deleted_at=NOW() WHERE id=$1", [photo.id]);
        expect((await messages.history(member, conversation.id, { limit: 1 })).messages[0].sender.profilePhoto).toBeNull();
        await client.query("UPDATE users.profiles SET deleted_at=NOW() WHERE user_id=$1", [owner]);
        expect((await messages.history(member, conversation.id, { limit: 1 })).messages[0].sender).toEqual({ id: owner, username: null, displayName: null, profilePhoto: null });
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT sender_profile_test");
        await client.query("RELEASE SAVEPOINT sender_profile_test");
      }
    });
    test("inbox, monotonic unread state, preferences and duplicate reports", async () => {
      const conversation = await repository.create(owner, {
        type: "group",
        groupId: group,
      });
      const { message } = await messages.send(owner, conversation.id, {
        text: "Inbox test",
        clientMessageId: crypto.randomUUID(),
      });
      const page = await inbox.list(member, { limit: 30, archived: false });
      expect(
        page.conversations.find((row) => row.id === conversation.id)
          .unreadCount,
      ).toBe(1);
      expect((await inbox.unread(member)).unreadCount).toBe(1);
      await inbox.read(member, conversation.id, message.id);
      expect((await inbox.unread(member)).unreadCount).toBe(0);
      await inbox.settings(member, conversation.id, {
        muted: true,
        archived: true,
      });
      expect(
        (await inbox.list(member, { limit: 30, archived: false }))
          .conversations,
      ).toHaveLength(0);
      expect(
        (await inbox.list(member, { limit: 30, archived: true }))
          .conversations[0].muted,
      ).toBe(true);
      const first = await inbox.report(member, conversation.id, message.id, {
        reasonCode: "SPAM",
      });
      expect(
        await inbox.report(member, conversation.id, message.id, {
          reasonCode: "SPAM",
        }),
      ).toEqual(first);
      await inbox.settings(member, conversation.id, { archived: false });
    });
    test("local inbox load smoke: 200 reads at concurrency 10", async () => {
      const durations = [];
      const start = performance.now();
      for (let batch = 0; batch < 20; batch++) {
        await Promise.all(
          Array.from({ length: 10 }, async () => {
            const requestStart = performance.now();
            const response = await inbox.list(member, {
              limit: 30,
              archived: false,
            });
            expect(Array.isArray(response.conversations)).toBe(true);
            durations.push(performance.now() - requestStart);
          }),
        );
      }
      durations.sort((a, b) => a - b);
      console.log(
        JSON.stringify({
          scope:
            "local service/one PostgreSQL connection; not HTTP/device/production",
          requests: 200,
          concurrency: 10,
          p50Ms: +durations[99].toFixed(2),
          p95Ms: +durations[189].toFixed(2),
          p99Ms: +durations[197].toFixed(2),
          totalMs: +(performance.now() - start).toFixed(2),
        }),
      );
    });
    test("one pending request text: sender-only, no replies, idempotent retries", async () => {
      const {
        rows: [target],
      } = await client.query(
        "INSERT INTO auth.users(status) VALUES('ACTIVE') RETURNING id",
      );
      const conversation = await repository.create(owner, {
        type: "direct",
        userId: target.id,
      });
      const input = { text: "Hello", clientMessageId: crypto.randomUUID() };
      await expect(
        messages.send(owner, conversation.id, input),
      ).rejects.toMatchObject({ statusCode: 403 });
      const sent = await messages.send(owner, conversation.id, input, {
        requestMessage: true,
      });
      expect(sent.created).toBe(true);
      expect(
        (
          await messages.send(owner, conversation.id, input, {
            requestMessage: true,
          })
        ).created,
      ).toBe(false);
      await expect(
        messages.send(
          target.id,
          conversation.id,
          { ...input, clientMessageId: crypto.randomUUID() },
          { requestMessage: true },
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        messages.send(
          owner,
          conversation.id,
          { ...input, clientMessageId: crypto.randomUUID() },
          { requestMessage: true },
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await repository.respond(conversation.id, target.id, "ACCEPTED");
      expect(
        (
          await messages.send(owner, conversation.id, input, {
            requestMessage: true,
          })
        ).created,
      ).toBe(false);
      expect(
        (
          await messages.send(target.id, conversation.id, {
            text: "Hi",
            clientMessageId: crypto.randomUUID(),
          })
        ).created,
      ).toBe(true);
    });
    test("replay cursors are user-scoped, retry-stable, paginated and revoke blocked access", async () => {
      const {
        rows: [target],
      } = await client.query(
        "INSERT INTO auth.users(status) VALUES('ACTIVE') RETURNING id",
      );
      const conversation = await repository.create(owner, {
        type: "direct",
        userId: target.id,
      });
      const event = {
        id: "900000001",
        conversation_id: conversation.id,
        message_id: null,
        event_type: "request.responded",
      };
      const first = await recordUserEvent(client, target.id, event);
      expect(await recordUserEvent(client, target.id, event)).toEqual(first);
      await recordUserEvent(client, target.id, { ...event, id: "900000002" });
      const page = await events.replay(target.id, { after: "0", limit: 1 });
      expect(page.events).toHaveLength(1);
      expect(page.hasMore).toBe(true);
      expect(
        (await events.replay(target.id, { after: page.nextCursor, limit: 1 }))
          .events,
      ).toHaveLength(1);
      expect((await events.replay(target.id, {})).resyncRequired).toBe(true);
      await expect(
        events.replay(member, { after: page.nextCursor }),
      ).rejects.toMatchObject({ statusCode: 409 });
      await client.query(
        "INSERT INTO users.blocked_users(user_id,blocked_user_id) VALUES($1,$2)",
        [owner, target.id],
      );
      expect((await events.replay(target.id, { after: "0" })).events).toEqual(
        [],
      );
      await client.query(
        "UPDATE chat.user_events SET created_at=clock_timestamp()-INTERVAL '8 days' WHERE user_id=$1",
        [target.id],
      );
      expect(
        (await events.replay(target.id, { after: "0" })).resyncRequired,
      ).toBe(true);
    });
    test("replay revokes group membership and hides personally hidden message events", async () => {
      const {
        rows: [target],
      } = await client.query(
        "INSERT INTO auth.users(status) VALUES('ACTIVE') RETURNING id",
      );
      const {
        rows: [newGroup],
      } = await client.query(
        "INSERT INTO groups.groups(owner_id,name) VALUES($1,'Replay test') RETURNING id",
        [owner],
      );
      await client.query(
        "INSERT INTO groups.group_members(group_id,user_id,role,status,added_by) VALUES($1,$2,'MEMBER','ACTIVE',$3)",
        [newGroup.id, target.id, owner],
      );
      const conversation = await repository.create(owner, {
        type: "group",
        groupId: newGroup.id,
      });
      const { message } = await messages.send(owner, conversation.id, {
        text: "Replay access",
        clientMessageId: crypto.randomUUID(),
      });
      await recordUserEvent(client, target.id, {
        id: "900000003",
        conversation_id: conversation.id,
        message_id: message.id,
        event_type: "message.created",
      });
      expect(
        (await events.replay(target.id, { after: "0" })).events,
      ).toHaveLength(1);
      await client.query(
        "INSERT INTO chat.hidden_messages(message_id,user_id) VALUES($1,$2)",
        [message.id, target.id],
      );
      expect(
        (await events.replay(target.id, { after: "0" })).events,
      ).toHaveLength(0);
      await client.query(
        "DELETE FROM chat.hidden_messages WHERE message_id=$1 AND user_id=$2",
        [message.id, target.id],
      );
      await client.query(
        "UPDATE groups.group_members SET status='REMOVED',removed_at=CURRENT_TIMESTAMP WHERE group_id=$1 AND user_id=$2",
        [newGroup.id, target.id],
      );
      expect(
        (await events.replay(target.id, { after: "0" })).events,
      ).toHaveLength(0);
    });
    test("conversation sequence is transactional, retry-stable and survives outbox pruning", async () => {
      const conversation = await repository.create(owner, {
        type: "group",
        groupId: group,
      });
      const {
        rows: [before],
      } = await client.query(
        "SELECT event_sequence::text FROM chat.conversations WHERE id=$1",
        [conversation.id],
      );
      await client.query("SAVEPOINT sequence_rollback");
      const {
        rows: [rolledBack],
      } = await client.query(
        "INSERT INTO chat.event_outbox(conversation_id,event_type) VALUES($1,'test.rollback') RETURNING *",
        [conversation.id],
      );
      expect(BigInt(rolledBack.conversation_sequence)).toBe(
        BigInt(before.event_sequence) + 1n,
      );
      await client.query("ROLLBACK TO SAVEPOINT sequence_rollback");
      await client.query("RELEASE SAVEPOINT sequence_rollback");
      const {
        rows: [event],
      } = await client.query(
        "INSERT INTO chat.event_outbox(conversation_id,event_type) VALUES($1,'test.sequence') RETURNING *",
        [conversation.id],
      );
      expect(event.conversation_sequence).toBe(
        rolledBack.conversation_sequence,
      );
      const delivery = await recordUserEvent(client, owner, event);
      expect(delivery.conversationSequence).toBe(event.conversation_sequence);
      expect(await recordUserEvent(client, owner, event)).toEqual(delivery);
      await client.query("DELETE FROM chat.event_outbox WHERE id=$1", [
        event.id,
      ]);
      const {
        rows: [next],
      } = await client.query(
        "INSERT INTO chat.event_outbox(conversation_id,event_type) VALUES($1,'test.next') RETURNING *",
        [conversation.id],
      );
      expect(BigInt(next.conversation_sequence)).toBe(
        BigInt(event.conversation_sequence) + 1n,
      );
      const replay = await events.replay(owner, { after: "0" });
      expect(
        replay.events.find((row) => row.eventId === event.id)
          .conversationSequence,
      ).toBe(event.conversation_sequence);
      const other = await repository.create(owner, {
        type: "direct",
        userId: member,
      });
      const {
        rows: [otherEvent],
      } = await client.query(
        "INSERT INTO chat.event_outbox(conversation_id,event_type) VALUES($1,'test.other') RETURNING *",
        [other.id],
      );
      const {
        rows: [state],
      } = await client.query(
        "SELECT event_sequence::text FROM chat.conversations WHERE id=$1",
        [conversation.id],
      );
      expect(state.event_sequence).toBe(next.conversation_sequence);
      expect(otherEvent.conversation_id).not.toBe(conversation.id);
    });
    test("batched fan-out journals 1001 recipients with bounded queries and stable retries", async () => {
      const { rows: users } = await client.query(
        "INSERT INTO auth.users(status) SELECT 'ACTIVE' FROM generate_series(1,1000) RETURNING id",
      );
      const {
        rows: [largeGroup],
      } = await client.query(
        "INSERT INTO groups.groups(owner_id,name) VALUES($1,'Fan-out test') RETURNING id",
        [owner],
      );
      await client.query(
        "INSERT INTO groups.group_members(group_id,user_id,role,status,added_by) SELECT $1,id,'MEMBER','ACTIVE',$3 FROM unnest($2::uuid[]) id",
        [largeGroup.id, users.map((row) => row.id), owner],
      );
      const conversation = await repository.create(owner, {
        type: "group",
        groupId: largeGroup.id,
      });
      const recipients = await repository.recipients(client, conversation.id);
      expect(recipients).toHaveLength(1001);
      const {
        rows: [event],
      } = await client.query(
        "INSERT INTO chat.event_outbox(conversation_id,event_type) VALUES($1,'test.fanout') RETURNING *",
        [conversation.id],
      );
      const ids = recipients.map((row) => row.user_id),
        deliveries = [];
      let queries = 0;
      const counted = {
        query: (...args) => {
          queries++;
          return client.query(...args);
        },
      };
      const start = performance.now();
      for (let offset = 0; offset < ids.length; offset += 500)
        deliveries.push(
          ...(await recordUserEventBatch(
            counted,
            ids.slice(offset, offset + 500),
            event,
          )),
        );
      expect(queries).toBe(9);
      expect(deliveries).toHaveLength(1001);
      expect(new Set(deliveries.map((row) => row.userId)).size).toBe(1001);
      const retried = await recordUserEventBatch(
        client,
        ids.slice(0, 500),
        event,
      );
      for (const delivery of retried)
        expect(delivery).toEqual(
          deliveries.find((row) => row.userId === delivery.userId),
        );
      await client.query(
        "UPDATE groups.group_members SET status='REMOVED',removed_at=CURRENT_TIMESTAMP WHERE group_id=$1 AND user_id=$2",
        [largeGroup.id, users[0].id],
      );
      expect(
        await repository.recipients(client, conversation.id, [users[0].id]),
      ).toEqual([]);
      expect(
        await repository.recipients(client, conversation.id, [owner]),
      ).toEqual([{ user_id: owner }]);
      console.log(
        JSON.stringify({
          scope: "local rollback-only PostgreSQL, not network/device",
          recipients: 1001,
          journalQueries: queries,
          journalAndRetryMs: +(performance.now() - start).toFixed(2),
        }),
      );
    });
    afterAll(async () => {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } finally {
          await client.end();
        }
      }
    });
    test("non-connections require recipient approval and repeated creation is idempotent", async () => {
      const conversation = await repository.create(owner, {
        type: "direct",
        userId: member,
      });
      expect(conversation.request_status).toBe("PENDING");
      expect(
        (await repository.create(owner, { type: "direct", userId: member })).id,
      ).toBe(conversation.id);
      expect(
        await repository.respond(conversation.id, owner, "ACCEPTED"),
      ).toBeNull();
      expect(
        (await repository.respond(conversation.id, member, "ACCEPTED"))
          .request_status,
      ).toBe("ACCEPTED");
      expect(
        (await repository.respond(conversation.id, member, "ACCEPTED"))
          .request_status,
      ).toBe("ACCEPTED");
      expect(
        await repository.respond(conversation.id, member, "REJECTED"),
      ).toEqual({ conflict: true });
    });
    test("blocking hides a direct conversation in both directions", async () => {
      const conversation = await repository.create(owner, {
        type: "direct",
        userId: member,
      });
      await client.query(
        "INSERT INTO users.blocked_users (user_id,blocked_user_id) VALUES ($1,$2)",
        [owner, member],
      );
      expect(
        await repository.access(client, conversation.id, owner),
      ).toBeNull();
      expect(
        await repository.access(client, conversation.id, member),
      ).toBeNull();
      expect(
        await repository.create(member, { type: "direct", userId: owner }),
      ).toBeNull();
      await client.query(
        "DELETE FROM users.blocked_users WHERE user_id=$1 AND blocked_user_id=$2",
        [owner, member],
      );
    });
    test("text messages support deduplication, replies, edits and personal hiding", async () => {
      const conversation = await repository.create(owner, {
        type: "direct",
        userId: member,
      });
      const input = {
        text: "Hello",
        clientMessageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      };
      const sent = await messages.send(owner, conversation.id, input);
      expect(sent.created).toBe(true);
      expect((await messages.send(owner, conversation.id, input)).created).toBe(
        false,
      );
      await expect(
        messages.send(owner, conversation.id, { ...input, text: "Changed" }),
      ).rejects.toMatchObject({ statusCode: 409 });
      const reply = await messages.send(member, conversation.id, {
        text: "Reply",
        clientMessageId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        replyToMessageId: sent.message.id,
      });
      expect(reply.message.replyToMessageId).toBe(sent.message.id);
      expect(
        (
          await messages.mutate(
            owner,
            conversation.id,
            sent.message.id,
            "edit",
            { text: "Edited" },
          )
        ).message.text,
      ).toBe("Edited");
      expect((await messages.send(owner, conversation.id, input)).created).toBe(
        false,
      );
      await messages.react(member, conversation.id, sent.message.id, "❤️");
      await messages.react(member, conversation.id, sent.message.id, "❤️");
      expect(
        (
          await messages.history(owner, conversation.id, { limit: 30 })
        ).messages.find((m) => m.id === sent.message.id).reactions,
      ).toHaveLength(1);
      expect(
        (
          await messages.receipt(
            member,
            conversation.id,
            sent.message.id,
            "READ",
          )
        ).status,
      ).toBe("READ");
      expect(
        (
          await messages.receipt(
            member,
            conversation.id,
            sent.message.id,
            "DELIVERED",
          )
        ).status,
      ).toBe("READ");
      const page = await messages.history(owner, conversation.id, { limit: 1 });
      expect(page.pagination.hasMore).toBe(true);
      expect(
        (
          await messages.history(owner, conversation.id, {
            limit: 1,
            cursor: page.pagination.nextCursor,
          })
        ).messages[0].id,
      ).not.toBe(page.messages[0].id);
      await expect(
        messages.mutate(member, conversation.id, sent.message.id, "edit", {
          text: "No",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      await messages.mutate(member, conversation.id, sent.message.id, "hide");
      expect(
        (
          await messages.history(member, conversation.id, { limit: 30 })
        ).messages.some((m) => m.id === sent.message.id),
      ).toBe(false);
      expect(
        (
          await messages.history(owner, conversation.id, { limit: 30 })
        ).messages.some((m) => m.id === sent.message.id),
      ).toBe(true);
      expect(
        (
          await messages.mutate(
            owner,
            conversation.id,
            sent.message.id,
            "delete",
          )
        ).message,
      ).toMatchObject({ deleted: true, text: null });
      expect(
        (
          await messages.mutate(
            owner,
            conversation.id,
            sent.message.id,
            "delete",
          )
        ).message.deleted,
      ).toBe(true);
      expect(
        (await messages.send(owner, conversation.id, input)).message.deleted,
      ).toBe(true);
      await expect(
        messages.react(member, conversation.id, sent.message.id, "❤️"),
      ).rejects.toMatchObject({ statusCode: 404 });
      const {
        rows: [eventCount],
      } = await client.query(
        "SELECT COUNT(*)::int AS count FROM chat.event_outbox WHERE conversation_id=$1",
        [conversation.id],
      );
      expect(eventCount.count).toBeGreaterThan(0);
      await client.query(
        "UPDATE chat.chat_messages SET created_at=CURRENT_TIMESTAMP - INTERVAL '49 hours' WHERE id=$1",
        [reply.message.id],
      );
      await expect(
        messages.mutate(member, conversation.id, reply.message.id, "delete"),
      ).rejects.toMatchObject({ code: "CHAT.DELETE_WINDOW_EXPIRED" });
    });
    test("group conversations are idempotent and access follows live membership", async () => {
      const conversation = await repository.create(owner, {
        type: "group",
        groupId: group,
      });
      expect(
        (await repository.create(member, { type: "group", groupId: group })).id,
      ).toBe(conversation.id);
      await client.query(
        "UPDATE groups.group_members SET status='REMOVED',removed_at=CURRENT_TIMESTAMP WHERE group_id=$1 AND user_id=$2",
        [group, member],
      );
      expect(
        await repository.access(client, conversation.id, member),
      ).toBeNull();
      expect(
        await repository.create(member, { type: "group", groupId: group }),
      ).toBeNull();
      expect(
        (await repository.access(client, conversation.id, owner)).can_send,
      ).toBe(true);
    });
    test("itinerary sharing grants read-only access and deletion revokes it", async () => {
      const {
        rows: [traveler],
      } = await client.query(
        "INSERT INTO auth.users (status) VALUES ('ACTIVE') RETURNING id",
      );
      const conversation = await repository.create(owner, {
        type: "direct",
        userId: traveler.id,
      });
      await expect(
        messages.send(owner, conversation.id, {
          text: "No",
          clientMessageId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      await repository.respond(conversation.id, traveler.id, "ACCEPTED");
      const {
        rows: [itinerary],
      } = await client.query(
        "INSERT INTO itinerary.itineraries (created_by,title,visibility,itinerary_json) VALUES ($1,'Private itinerary','private','{\"days\":[]}') RETURNING id",
        [owner],
      );
      const shared = await messages.send(owner, conversation.id, {
        itineraryId: itinerary.id,
        clientMessageId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      });
      expect(
        await messages.itinerary(
          traveler.id,
          conversation.id,
          shared.message.id,
        ),
      ).toMatchObject({ readOnly: true, itinerary: { id: itinerary.id } });
      await expect(
        messages.send(traveler.id, conversation.id, {
          itineraryId: itinerary.id,
          clientMessageId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      await client.query(
        "UPDATE groups.groups SET itinerary_id=$1 WHERE id=$2",
        [itinerary.id, group],
      );
      await client.query(
        "UPDATE groups.group_members SET status='ACTIVE',removed_at=NULL WHERE group_id=$1 AND user_id=$2",
        [group, member],
      );
      const memberChat = await repository.create(member, {
        type: "direct",
        userId: traveler.id,
      });
      await repository.respond(memberChat.id, traveler.id, "ACCEPTED");
      const memberShare = await messages.send(member, memberChat.id, {
        itineraryId: itinerary.id,
        clientMessageId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      });
      expect(
        (
          await messages.itinerary(
            traveler.id,
            memberChat.id,
            memberShare.message.id,
          )
        ).readOnly,
      ).toBe(true);
      const groupChat = await repository.create(owner, {
        type: "group",
        groupId: group,
      });
      const groupShare = await messages.send(owner, groupChat.id, {
        itineraryId: itinerary.id,
        clientMessageId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      });
      await client.query(
        "UPDATE groups.group_members SET status='REMOVED',removed_at=CURRENT_TIMESTAMP WHERE group_id=$1 AND user_id=$2",
        [group, member],
      );
      await expect(
        messages.itinerary(member, groupChat.id, groupShare.message.id),
      ).rejects.toMatchObject({ statusCode: 404 });
      await messages.mutate(
        owner,
        conversation.id,
        shared.message.id,
        "delete",
      );
      await expect(
        messages.itinerary(traveler.id, conversation.id, shared.message.id),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
    test("attachments are owner-scoped and revoked after personal hiding", async () => {
      const conversation = await repository.create(owner, {
        type: "direct",
        userId: member,
      });
      const {
        rows: [asset],
      } = await client.query(
        `INSERT INTO media.assets
      (storage_provider,bucket,storage_key,mime_type,extension,file_size,checksum,uploaded_by,is_public,original_filename)
      VALUES ('local','local','chat/test.pdf','application/pdf','pdf',10,$1,$2,false,'test.pdf') RETURNING id`,
        [`chat-test-${owner}`, owner],
      );
      malwareScan.mockRejectedValueOnce(
        Object.assign(new Error("rejected"), {
          statusCode: 422,
          code: "CHAT.ATTACHMENT_MALWARE_DETECTED",
        }),
      );
      const rejectedClientId = crypto.randomUUID();
      await expect(
        messages.send(owner, conversation.id, {
          assetIds: [asset.id],
          clientMessageId: rejectedClientId,
        }),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(
        (
          await client.query(
            "SELECT id FROM chat.chat_messages WHERE client_message_id=$1",
            [rejectedClientId],
          )
        ).rows,
      ).toHaveLength(0);
      const sent = await messages.send(owner, conversation.id, {
        assetIds: [asset.id],
        clientMessageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      });
      expect(
        (
          await messages.history(member, conversation.id, { limit: 100 })
        ).messages.find((m) => m.id === sent.message.id).assets[0],
      ).toMatchObject({ id: asset.id, mimeType: "application/pdf" });
      expect(
        (
          await messages.attachment(
            member,
            conversation.id,
            sent.message.id,
            asset.id,
          )
        ).mimeType,
      ).toBe("application/pdf");
      await expect(
        messages.send(member, conversation.id, {
          assetIds: [asset.id],
          clientMessageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
      await messages.mutate(member, conversation.id, sent.message.id, "hide");
      await expect(
        messages.attachment(member, conversation.id, sent.message.id, asset.id),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
    test("accepted connections do not need a message request", async () => {
      const {
        rows: [user],
      } = await client.query(
        "INSERT INTO auth.users (status) VALUES ('ACTIVE') RETURNING id",
      );
      await client.query(
        "INSERT INTO users.connections (user_low_id,user_high_id) VALUES ($1,$2)",
        [owner, user.id].sort(),
      );
      expect(
        (await repository.create(owner, { type: "direct", userId: user.id }))
          .request_status,
      ).toBe("ACCEPTED");
    });
    test("community members read but only admins or owner can send; bans revoke access", async () => {
      const {
        rows: [asset],
      } = await client.query("SELECT id FROM media.assets LIMIT 1");
      if (!asset)
        throw new Error("Local community fixture requires one media asset.");
      const {
        rows: [community],
      } = await client.query(
        "INSERT INTO community.communities (owner_id,name,icon_asset_id) VALUES ($1,'Chat test',$2) RETURNING id",
        [owner, asset.id],
      );
      await client.query(
        "INSERT INTO community.community_members (community_id,user_id,role,status) VALUES ($1,$2,'MEMBER','ACTIVE')",
        [community.id, member],
      );
      const conversation = await repository.create(member, {
        type: "community",
        communityId: community.id,
      });
      expect(conversation.can_send).toBe(false);
      expect(
        new Set(
          (await repository.recipients(client, conversation.id)).map(
            (row) => row.user_id,
          ),
        ),
      ).toEqual(new Set([owner, member]));
      await expect(
        messages.send(member, conversation.id, {
          text: "Forbidden",
          clientMessageId: "abababab-abab-4bab-8bab-abababababab",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      const adminMessage = await messages.send(owner, conversation.id, {
        text: "Announcement",
        clientMessageId: "abababab-abab-4bab-8bab-abababababab",
      });
      expect(
        (
          await messages.react(
            member,
            conversation.id,
            adminMessage.message.id,
            "👍",
          )
        ).removed,
      ).toBe(false);
      expect(
        (await repository.access(client, conversation.id, owner)).can_send,
      ).toBe(true);
      await client.query(
        "UPDATE community.community_members SET role='ADMIN' WHERE community_id=$1 AND user_id=$2",
        [community.id, member],
      );
      expect(
        (await repository.access(client, conversation.id, member)).can_send,
      ).toBe(true);
      await client.query(
        "INSERT INTO community.community_bans (community_id,user_id,banned_user_id) VALUES ($1,$2,$3)",
        [community.id, owner, member],
      );
      expect(
        await repository.access(client, conversation.id, member),
      ).toBeNull();
      expect(await repository.recipients(client, conversation.id)).toEqual([
        { user_id: owner },
      ]);
    });
  },
);
