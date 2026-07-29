// import jwt from "jsonwebtoken";

// import security from "../../config/security.js";

// import InvalidAccessTokenError from "../errors/auth/invalid-access-token.error.js";
// import InvalidRefreshTokenError from "../errors/auth/invalid-refresh-token.error.js";
// import SessionExpiredError from "../errors/auth/session-expired.error.js";

// class JwtService {

//     generateAccessToken(payload) {

//         return jwt.sign(
//             {
//                 ...payload,
//                 type: "access"
//             },
//             security.jwt.accessSecret,
//             {
//                 algorithm: security.jwt.algorithm,
//                 expiresIn: security.jwt.accessExpiresIn
//             }
//         );

//     }

//     generateRefreshToken(payload) {

//         return jwt.sign(
//             {
//                 ...payload,
//                 type: "refresh"
//             },
//             security.jwt.refreshSecret,
//             {
//                 algorithm: security.jwt.algorithm,
//                 expiresIn: security.jwt.refreshExpiresIn
//             }
//         );

//     }

//     verifyAccessToken(token) {

//         const payload = jwt.verify(
//             token,
//             security.jwt.accessSecret,
//             {
//                 algorithms: [security.jwt.algorithm]
//             }
//         );

//         if (payload.type !== "access") {

//             throw new Error("Invalid access token.");

//         }

//         return payload;

//     }

//     verifyRefreshToken(token) {

//         try {

//             const payload = jwt.verify(

//                 token,

//                 security.jwt.refreshSecret,

//                 {

//                     algorithms: [security.jwt.algorithm]

//                 }

//             );

//             if (payload.type !== "refresh") {

//                 throw new InvalidRefreshTokenError();

//             }

//             return payload;

//         } catch (error) {

//             if (error instanceof jwt.TokenExpiredError) {

//                 throw new SessionExpiredError({

//                     cause: error

//                 });

//             }

//             if (error instanceof jwt.JsonWebTokenError) {

//                 throw new InvalidRefreshTokenError({

//                     cause: error

//                 });

//             }

//             throw error;

//         }

//     }

// }

// export default new JwtService();

import jwt from "jsonwebtoken";

import security from "../../config/security.js";

import InvalidAccessTokenError from "../errors/auth/invalid-access-token.error.js";
import InvalidRefreshTokenError from "../errors/auth/invalid-refresh-token.error.js";
import SessionExpiredError from "../errors/auth/session-expired.error.js";

class JwtService {
  generateAccessToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: "access",
      },
      security.jwt.accessSecret,
      {
        algorithm: security.jwt.algorithm,
        expiresIn: security.jwt.accessExpiresIn,
      },
    );
  }

  generateRefreshToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: "refresh",
      },
      security.jwt.refreshSecret,
      {
        algorithm: security.jwt.algorithm,
        expiresIn: security.jwt.refreshExpiresIn,
      },
    );
  }

  verifyAccessToken(token) {
    try {
      const payload = jwt.verify(token, security.jwt.accessSecret, {
        algorithms: [security.jwt.algorithm],
      });

      if (
        typeof payload !== "object" ||
        payload === null ||
        payload.type !== "access" ||
        typeof payload.sub !== "string" ||
        payload.sub.length === 0 ||
        typeof payload.sid !== "string" ||
        payload.sid.length === 0
      ) {
        throw new InvalidAccessTokenError();
      }

      return payload;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        throw error;
      }

      if (error instanceof InvalidAccessTokenError) {
        throw error;
      }

      if (error instanceof jwt.TokenExpiredError) {
        throw new SessionExpiredError({
          cause: error,
        });
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidAccessTokenError({
          cause: error,
        });
      }

      throw error;
    }
  }

  verifyRefreshToken(token) {
    try {
      const payload = jwt.verify(token, security.jwt.refreshSecret, {
        algorithms: [security.jwt.algorithm],
      });

      if (
        typeof payload !== "object" ||
        payload === null ||
        payload.type !== "refresh" ||
        typeof payload.sub !== "string" ||
        payload.sub.length === 0 ||
        typeof payload.sid !== "string" ||
        payload.sid.length === 0
      ) {
        throw new InvalidRefreshTokenError();
      }

      return payload;
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        throw error;
      }

      if (error instanceof InvalidRefreshTokenError) {
        throw error;
      }

      if (error instanceof jwt.TokenExpiredError) {
        throw new SessionExpiredError({
          cause: error,
        });
      }

      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidRefreshTokenError({
          cause: error,
        });
      }

      throw error;
    }
  }
}

export default new JwtService();
