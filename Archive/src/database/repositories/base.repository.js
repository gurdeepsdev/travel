import db from "../database-manager.js";

export default class BaseRepository {

    constructor(schema, table) {

        this.schema = schema;
        this.table = table;

    }

    get fullTableName() {

        return `${this.schema}.${this.table}`;

    }

    async findById(id) {

        const query = `
            SELECT *
            FROM ${this.fullTableName}
            WHERE id = $1
            LIMIT 1
        `;

        const { rows } = await db.query(query, [id]);

        return rows[0] ?? null;

    }

    async findOne(whereClause, params = []) {

        const query = `
            SELECT *
            FROM ${this.fullTableName}
            WHERE ${whereClause}
            LIMIT 1
        `;

        const { rows } = await db.query(query, params);

        return rows[0] ?? null;

    }

    async exists(whereClause, params = []) {

        const query = `
            SELECT EXISTS(
                SELECT 1
                FROM ${this.fullTableName}
                WHERE ${whereClause}
            ) AS exists
        `;

        const { rows } = await db.query(query, params);

        return rows[0].exists;

    }

    async deleteById(id) {

        const query = `
            DELETE
            FROM ${this.fullTableName}
            WHERE id = $1
        `;

        await db.query(query, [id]);

    }

    async query(sql, params = []) {

        return db.query(sql, params);

    }

}