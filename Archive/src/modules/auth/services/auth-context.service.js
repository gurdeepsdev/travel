// import JwtService from "../../../core/security/jwt.js";

// import SessionsRepository from "../repositories/sessions.repository.js";
// import UsersRepository from "../repositories/users.repository.js";
// import IdentitiesRepository from "../repositories/identities.repository.js";

// import ProfilesRepository from "../../users/repositories/profiles.repository.js";

// class AuthContextService {

//     async authenticate(token) {

//         const payload = JwtService.verifyAccessToken(token);

//         const session = await SessionsRepository.findById(payload.sid);

//         if (!session) {

//             throw new Error("Session not found.");

//         }

//         const user = await UsersRepository.findById(payload.sub);

//         if (!user) {

//             throw new Error("User not found.");

//         }

//         const identity = await IdentitiesRepository.findOne(

//             "user_id = $1 AND is_primary = true",

//             [user.id]

//         );

//         const profile = await ProfilesRepository.findByUserId(
//             user.id
//         );

//         return {

//             jwt: payload,

//             session,

//             user,

//             identity,

//             profile

//         };

//     }

// }

// export default new AuthContextService();

import InvalidAccessTokenError from "../../../core/errors/auth/invalid-access-token.error.js";
import SessionExpiredError from "../../../core/errors/auth/session-expired.error.js";
import JwtService from "../../../core/security/jwt.js";

import IdentitiesRepository from "../repositories/identities.repository.js";
import SessionsRepository from "../repositories/sessions.repository.js";
import UsersRepository from "../repositories/users.repository.js";

import ProfilesRepository from "../../users/repositories/profiles.repository.js";

class AuthContextService {
  async authenticate(token) {
    const payload = JwtService.verifyAccessToken(token);

    const session = await SessionsRepository.findById(payload.sid);

    if (!session) {
      throw new SessionExpiredError();
    }

    const sessionExpiresAt = new Date(session.expires_at);

    if (
      Number.isNaN(sessionExpiresAt.getTime()) ||
      sessionExpiresAt.getTime() <= Date.now()
    ) {
      throw new SessionExpiredError();
    }

    if (session.user_id !== payload.sub) {
      throw new InvalidAccessTokenError();
    }

    const user = await UsersRepository.findById(payload.sub);

    if (!user) {
      throw new InvalidAccessTokenError();
    }

    const identity = await IdentitiesRepository.findOne(
      "user_id = $1 AND is_primary = true",
      [user.id],
    );

    const profile = await ProfilesRepository.findByUserId(user.id);

    return {
      jwt: payload,
      session,
      user,
      identity,
      profile,
    };
  }
}

export default new AuthContextService();
