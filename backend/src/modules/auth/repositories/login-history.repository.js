import BaseRepository from "../../../database/repositories/base.repository.js";

class LoginHistoryRepository extends BaseRepository {

    constructor() {

        super("auth", "login_history");

    }

}

export default new LoginHistoryRepository();