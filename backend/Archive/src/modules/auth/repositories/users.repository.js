import BaseRepository from "../../../database/repositories/base.repository.js";

class UsersRepository extends BaseRepository {

    constructor() {

        super("auth", "users");

    }

    async create(status = "ACTIVE") {

        const query = `
            INSERT INTO ${this.fullTableName}
            (
                status
            )
            VALUES
            (
                $1
            )
            RETURNING *
        `;

        const { rows } = await this.query(query, [status]);

        return rows[0];

    }

    async findById(id) {

        return super.findById(id);

    }

}

export default new UsersRepository();