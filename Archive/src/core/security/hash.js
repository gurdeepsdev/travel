import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

class HashService {

    async hash(value) {

        return bcrypt.hash(value, SALT_ROUNDS);

    }

    async compare(value, hash) {

        return bcrypt.compare(value, hash);

    }

}

export default new HashService();