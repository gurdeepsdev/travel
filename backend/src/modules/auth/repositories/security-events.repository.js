import BaseRepository from "../../../database/repositories/base.repository.js";

class SecurityEventsRepository extends BaseRepository {

    constructor() {

        super("auth", "security_events");

    }

    async create({

        userId = null,

        eventType,

        ipAddress = null,

        userAgent = null,

        metadata = null

    }) {

        const query = `
            INSERT INTO ${this.fullTableName}
            (
                user_id,
                event_type,
                ip_address,
                user_agent,
                metadata
            )
            VALUES
            (
                $1,$2,$3,$4,$5
            )
            RETURNING *
        `;

        const { rows } = await this.query(query, [

            userId,

            eventType,

            ipAddress,

            userAgent,

            metadata

        ]);

        return rows[0];

    }

}

export default new SecurityEventsRepository();