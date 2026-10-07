import Database from "../../database/database-manager.js";
import AppError from "../../core/errors/app-error.js";
import Repository from "./chat.repository.js";

export function mapConversation(row) {
  return {
    id: row.id,
    type: row.conversation_type,
    groupId: row.group_id ?? null,
    communityId: row.community_id ?? null,
    requestStatus: row.request_status,
    requestedBy: row.requested_by ?? null,
    canSend: row.request_status === "ACCEPTED" && row.can_send === true,
    eventSequence: String(row.event_sequence ?? "0"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ChatService {
  async require(result) {
    if (!result)
      throw new AppError({
        code: "CHAT.CONVERSATION_NOT_FOUND",
        message: "Conversation is unavailable.",
        statusCode: 404,
      });
    if (result.conflict)
      throw new AppError({
        code: "CHAT.REQUEST_ALREADY_DECIDED",
        message: "Message request has already been decided.",
        statusCode: 409,
      });
    return { conversation: mapConversation(result) };
  }
  async create(userId, input) {
    return this.require(await Repository.create(userId, input));
  }
  async get(userId, id) {
    return this.require(await Repository.access(Database, id, userId));
  }
  async respond(userId, id, status) {
    const result = await Repository.respond(id, userId, status);
    await this.require(result);
    return this.get(userId, id);
  }
}
export default new ChatService();
