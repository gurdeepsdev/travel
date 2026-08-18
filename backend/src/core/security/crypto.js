import crypto from "crypto";

class CryptoService {

    randomId(bytes = 16) {

        return crypto.randomBytes(bytes).toString("hex");

    }

    sha256(value) {

        return crypto
            .createHash("sha256")
            .update(value)
            .digest("hex");

    }

}

export default new CryptoService();