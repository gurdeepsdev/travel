import BaseRepository from "../../../database/repositories/base.repository.js";

class SecurityEventsRepository extends BaseRepository {

    constructor() {

        super("auth", "security_events");

    }

}

export default new SecurityEventsRepository();