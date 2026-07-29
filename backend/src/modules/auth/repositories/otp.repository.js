import BaseRepository from "../../../database/repositories/base.repository.js";

class OtpRepository extends BaseRepository {

    constructor() {
        super("auth", "otp_requests");
    }

    async create({
        identifier,
        provider,
        otpHash,
        expiresAt
    }) {

        const query = `
            INSERT INTO ${this.fullTableName}
            (
                identifier,
                provider,
                otp_hash,
                expires_at
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4
            )
            RETURNING *
        `;

        const { rows } = await this.query(query, [
            identifier,
            provider,
            otpHash,
            expiresAt
        ]);

        return rows[0];

    }

    async updateActive({

        id,
    
        otpHash,
    
        expiresAt
    
    }) {
    
        const query = `
            UPDATE ${this.fullTableName}
            SET
                otp_hash = $2,
                expires_at = $3,
                attempt_count = 0,
                verified_at = NULL
            WHERE id = $1
            RETURNING *
        `;
    
        const { rows } = await this.query(query, [
    
            id,
    
            otpHash,
    
            expiresAt
    
        ]);
    
        return rows[0];
    
    }

    async findLatest(identifier, provider) {

        const query = `
            SELECT *
            FROM ${this.fullTableName}
            WHERE identifier = $1
              AND provider = $2
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const { rows } = await this.query(query, [
            identifier,
            provider
        ]);

        return rows[0] ?? null;

    }

    async findActive(identifier, provider) {

        const query = `
            SELECT *
            FROM ${this.fullTableName}
            WHERE identifier = $1
              AND provider = $2
              AND verified_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
            LIMIT 1
        `;
    
        const { rows } = await this.query(query, [
            identifier,
            provider
        ]);
    
        return rows[0] ?? null;
    
    }

    async markVerified(id) {

        const query = `
            UPDATE ${this.fullTableName}
            SET verified_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;
    
        const { rows } = await this.query(query, [id]);
    
        return rows[0];
    
    }

    async incrementAttempts(id) {

        const query = `
            UPDATE ${this.fullTableName}
            SET attempt_count = attempt_count + 1
            WHERE id = $1
            RETURNING *
        `;
    
        const { rows } = await this.query(query, [id]);
    
        return rows[0];
    
    }

}

export default new OtpRepository();