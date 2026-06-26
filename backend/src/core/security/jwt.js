import jwt from "jsonwebtoken";

import security from "../../config/security.js";

class JwtService {

    generateAccessToken(payload) {

        return jwt.sign(
            {
                ...payload,
                type: "access"
            },
            security.jwt.accessSecret,
            {
                algorithm: security.jwt.algorithm,
                expiresIn: security.jwt.accessExpiresIn
            }
        );

    }

    generateRefreshToken(payload) {

        return jwt.sign(
            {
                ...payload,
                type: "refresh"
            },
            security.jwt.refreshSecret,
            {
                algorithm: security.jwt.algorithm,
                expiresIn: security.jwt.refreshExpiresIn
            }
        );

    }

    verifyAccessToken(token) {

        return jwt.verify(
            token,
            security.jwt.accessSecret,
            {
                algorithms: [security.jwt.algorithm]
            }
        );

    }

    verifyRefreshToken(token) {

        return jwt.verify(
            token,
            security.jwt.refreshSecret,
            {
                algorithms: [security.jwt.algorithm]
            }
        );

    }

}

export default new JwtService();