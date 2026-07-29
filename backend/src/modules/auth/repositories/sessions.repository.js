import BaseRepository from "../../../database/repositories/base.repository.js";


class SessionsRepository extends BaseRepository {

    constructor() {

        super("auth", "sessions");

    }
    async findById(id) {

        return super.findById(id);
    
    }
    async create({

        id,

        userId,

        refreshTokenHash,

        deviceName = null,

        deviceType = null,

        ipAddress = null,

        userAgent = null,

        expiresAt

    }) {

        const query = `
            INSERT INTO ${this.fullTableName}
            (
                id,
                user_id,
                refresh_token_hash,
                device_name,
                device_type,
                ip_address,
                user_agent,
                expires_at
            )
            VALUES
            (
                $1,$2,$3,$4,$5,$6,$7,$8
            )
            RETURNING *
        `;

        const { rows } = await this.query(query, [

            id,

            userId,

            refreshTokenHash,

            deviceName,

            deviceType,

            ipAddress,

            userAgent,

            expiresAt

        ]);

        return rows[0];

    }


    async findBySessionId(id) {

        return this.findById(id);
    
    }
    
    async updateRefreshToken({
    
        id,
    
        refreshTokenHash,
    
        expiresAt
    
    }) {
    
        const query = `
            UPDATE ${this.fullTableName}
            SET
                refresh_token_hash = $2,
                expires_at = $3
            WHERE id = $1
            RETURNING *
        `;
    
        const { rows } = await this.query(query, [
    
            id,
    
            refreshTokenHash,
    
            expiresAt
    
        ]);
    
        return rows[0];
    
    }
    
    async deleteBySessionId(id) {
    
        return this.deleteById(id);
    
    }

    async deleteAllByUserId(userId) {

        const query = `
            DELETE
            FROM ${this.fullTableName}
            WHERE user_id = $1
        `;
    
        await this.query(query, [
    
            userId
    
        ]);
    
    }
    async findByUserId(userId) {

        const query = `
            SELECT *
            FROM ${this.fullTableName}
            WHERE user_id = $1
            ORDER BY created_at DESC
        `;
    
        const { rows } = await this.query(query, [
    
            userId
    
        ]);
    
        return rows;
    
    }
    
    async deleteUserSession({
    
        sessionId,
    
        userId
    
    }) {
    
        const query = `
            DELETE
            FROM ${this.fullTableName}
            WHERE id = $1
            AND user_id = $2
        `;
    
        await this.query(query, [
    
            sessionId,
    
            userId
    
        ]);
    
    }

}

export default new SessionsRepository();