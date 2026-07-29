import BaseRepository from "../../../database/repositories/base.repository.js";

class LoginHistoryRepository extends BaseRepository {

    constructor() {

        super("auth", "login_history");

    }

    async create({

        userId = null,

        identifier,

        provider,

        ipAddress = null,

        userAgent = null,

        status,

        failureReason = null

    }) {

        const query = `
            INSERT INTO ${this.fullTableName}
            (
                user_id,
                identifier,
                provider,
                ip_address,
                user_agent,
                status,
                failure_reason
            )
            VALUES
            (
                $1,$2,$3,$4,$5,$6,$7
            )
            RETURNING *
        `;

        const { rows } = await this.query(query, [

            userId,

            identifier,

            provider,

            ipAddress,

            userAgent,

            status,

            failureReason

        ]);

        return rows[0];

    }

}

export default new LoginHistoryRepository();