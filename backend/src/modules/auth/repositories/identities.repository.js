import BaseRepository from "../../../database/repositories/base.repository.js";

class IdentitiesRepository extends BaseRepository {

    constructor() {

        super("auth", "identities");

    }

}

export default new IdentitiesRepository();