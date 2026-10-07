import Database from "../../database/database-manager.js";
import { authorize } from "./chat-messages.service.js";

export function registerChatTyping(socket, { authenticate, redis, emit }) {
  socket.on("chat:typing", async (input = {}, acknowledge) => {
    const reply = (value) => {
      if (typeof acknowledge === "function") acknowledge(value);
    };
    try {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          input.conversationId ?? "",
        ) ||
        typeof input.isTyping !== "boolean"
      ) {
        return reply({ success: false, code: "CHAT.INVALID_TYPING" });
      }
      const { user } = await authenticate();
      if (user.id !== socket.data.userId)
        return reply({ success: false, code: "AUTH.UNAUTHORIZED" });
      if (!(await redis.set(`chat:typing:${user.id}`, "1", "PX", 1000, "NX")))
        return reply({ success: false, code: "CHAT.RATE_LIMITED" });
      await Database.transaction(async (client) => {
        await authorize(client, input.conversationId, user.id, true);
        const { rows } = await client.query(
          `WITH candidates AS (
            SELECT user_id FROM chat.conversation_participants WHERE conversation_id=$2 AND left_at IS NULL
            UNION SELECT g.owner_id FROM chat.conversations c JOIN groups.groups g ON g.id=c.group_id WHERE c.id=$2
            UNION SELECT m.user_id FROM chat.conversations c JOIN groups.group_members m ON m.group_id=c.group_id WHERE c.id=$2 AND m.status='ACTIVE'
            UNION SELECT cm.owner_id FROM chat.conversations c JOIN community.communities cm ON cm.id=c.community_id WHERE c.id=$2
            UNION SELECT m.user_id FROM chat.conversations c JOIN community.community_members m ON m.community_id=c.community_id WHERE c.id=$2 AND upper(m.status)='ACTIVE'
          ) SELECT u.id FROM candidates r JOIN auth.users u ON u.id=r.user_id
          WHERE u.status='ACTIVE' AND u.id<>$1 AND EXISTS(
            SELECT 1 FROM chat.accessible_conversations(u.id) c WHERE c.id=$2)`,
          [user.id, input.conversationId],
        );
        for (const recipient of rows)
          emit(recipient.id, "chat.typing", {
            conversationId: input.conversationId,
            userId: user.id,
            isTyping: input.isTyping,
            expiresAt: Date.now() + 6000,
          });
      });
      reply({ success: true });
    } catch {
      reply({ success: false, code: "CHAT.TYPING_UNAVAILABLE" });
    }
  });
}
