import InvalidAccessTokenError from "../core/errors/auth/invalid-access-token.error.js";

import { AuthContextService } from "../modules/auth/services/index.js";

class AuthMiddleware {
  async authenticate(req, _res, next) {
    try {
      const authorizationHeader = req.headers.authorization;

      if (!authorizationHeader) {
        throw new InvalidAccessTokenError({
          message: "Authorization header is required.",
        });
      }

      const parts = authorizationHeader.trim().split(/\s+/);

      if (
        parts.length !== 2 ||
        parts[0].toLowerCase() !== "bearer" ||
        !parts[1]
      ) {
        throw new InvalidAccessTokenError({
          message: "Authorization header must use the Bearer token scheme.",
        });
      }

      const accessToken = parts[1];

      const context = await AuthContextService.authenticate(accessToken);

      req.context = {
        ...(req.context ?? {}),
        ...context,
      };

      req.user = context.user;
      req.session = context.session;
      req.identity = context.identity;
      req.profile = context.profile;

      return next();
    } catch (error) {
      return next(error);
    }
  }
}

export default new AuthMiddleware();
