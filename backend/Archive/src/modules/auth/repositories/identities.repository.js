import BaseRepository from "../../../database/repositories/base.repository.js";

class IdentitiesRepository extends BaseRepository {

    constructor() {

        super("auth", "identities");

    }

    async findByProvider(provider, identifier) {

        const query = `
            SELECT *
            FROM ${this.fullTableName}
            WHERE provider = $1
              AND provider_identifier = $2
            LIMIT 1
        `;

        const { rows } = await this.query(query, [

            provider,

            identifier

        ]);

        return rows[0] ?? null;

    }

    async create({

        userId,

        provider,

        identifier,

        isVerified = true,

        isPrimary = true

    }) {

        const query = `
            INSERT INTO ${this.fullTableName}
            (
                user_id,
                provider,
                provider_identifier,
                is_verified,
                is_primary
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5
            )
            RETURNING *
        `;

        const { rows } = await this.query(query, [

            userId,

            provider,

            identifier,

            isVerified,

            isPrimary

        ]);

        return rows[0];

    }

}

export default new IdentitiesRepository();