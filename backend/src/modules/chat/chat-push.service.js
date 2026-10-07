import { createHash } from "node:crypto";
import Database from "../../database/database-manager.js";
import AppError from "../../core/errors/app-error.js";

export default {
  async register(userId, sessionId, { deviceId, platform, token }) {
    try {
      return await Database.transaction(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO chat.push_devices(id,user_id,session_id,platform,token,token_hash)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET session_id=EXCLUDED.session_id,
          platform=EXCLUDED.platform,token=EXCLUDED.token,token_hash=EXCLUDED.token_hash,enabled=true,updated_at=CURRENT_TIMESTAMP
          WHERE chat.push_devices.user_id=EXCLUDED.user_id RETURNING id`,
          [
            deviceId,
            userId,
            sessionId,
            platform,
            token,
            createHash("sha256").update(token).digest("hex"),
          ],
        );
        if (!rows.length)
          throw new AppError({
            code: "CHAT.DEVICE_CONFLICT",
            message: "Device registration conflict.",
            statusCode: 409,
          });
        return { deviceId: rows[0].id, registered: true };
      });
    } catch (error) {
      if (error.code === "23505")
        throw new AppError({
          code: "CHAT.DEVICE_CONFLICT",
          message: "Device registration conflict.",
          statusCode: 409,
        });
      throw error;
    }
  },
  async remove(userId, deviceId) {
    await Database.query(
      "DELETE FROM chat.push_devices WHERE id=$1 AND user_id=$2",
      [deviceId, userId],
    );
    return { deviceId, registered: false };
  },
};
