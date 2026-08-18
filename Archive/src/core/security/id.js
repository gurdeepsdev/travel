import crypto from "crypto";

class IdService {

    uuid() {

        return crypto.randomUUID();

    }

    shortId(length = 8) {

        return crypto
            .randomBytes(length)
            .toString("hex")
            .slice(0, length);

    }

    publicId(prefix = "") {

        const id = crypto
            .randomBytes(8)
            .toString("hex");

        return prefix
            ? `${prefix}_${id}`
            : id;

    }

}

export default new IdService();