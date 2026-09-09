import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-streams-adapter";

import redis from "../config/redis.js";
import logger from "../core/logger/logger.js";
import { AuthContextService } from "../modules/auth/services/index.js";
import PostAccessService from "../modules/posts/services/post-access.service.js";

const POST_ROOM_PREFIX = "post:";
let io = null;

function extractToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.replace(/^Bearer\s+/i, "").trim();
  }

  const authorization = socket.handshake.headers.authorization;
  const match = typeof authorization === "string"
    ? authorization.match(/^Bearer\s+(.+)$/i)
    : null;

  return match?.[1]?.trim() ?? null;
}

function initializeRealtimeServer(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    adapter: createAdapter(redis),
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        return next(new Error("Authentication required."));
      }

      const context = await AuthContextService.authenticate(token);
      socket.data.userId = context.user.id;
      return next();
    } catch {
      return next(new Error("Authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);

    socket.on("post:subscribe", async ({ postId } = {}, acknowledge) => {
      try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId ?? "")) {
          throw new Error("Invalid post ID.");
        }

        await PostAccessService.assertCanInteract({
          postId,
          userId: socket.data.userId,
        });
        await socket.join(`${POST_ROOM_PREFIX}${postId}`);
        acknowledge?.({ success: true, postId });
      } catch {
        acknowledge?.({ success: false, code: "POST.NOT_FOUND" });
      }
    });

    socket.on("post:unsubscribe", async ({ postId } = {}, acknowledge) => {
      await socket.leave(`${POST_ROOM_PREFIX}${postId}`);
      acknowledge?.({ success: true, postId });
    });
  });

  logger.info("Realtime Socket.IO server initialized.");
  return io;
}

function emitPostEngagement(postId, payload) {
  if (!io) {
    throw new Error("Realtime server is not initialized.");
  }

  io.to(`${POST_ROOM_PREFIX}${postId}`).emit(
    "post.engagement.updated",
    payload,
  );
}

function emitUserEvent(userId, eventName, payload) {
  if (!io) {
    throw new Error("Realtime server is not initialized.");
  }
  io.to(`user:${userId}`).emit(eventName, payload);
}

export {
  emitPostEngagement,
  emitUserEvent,
  initializeRealtimeServer,
};
