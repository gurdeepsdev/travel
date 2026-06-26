import BaseRepository from "../../../database/repositories/base.repository.js";

class SessionsRepository extends BaseRepository {

    constructor() {

        super("auth", "sessions");

    }

}

export default new SessionsRepository();