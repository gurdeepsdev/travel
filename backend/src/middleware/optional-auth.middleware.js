import {
  AuthContextService,
} from "../modules/auth/services/index.js";

async function optionalAuthMiddleware(
  req,
  _res,
  next,
) {
  const authorizationHeader =
    req.headers.authorization;

  if (!authorizationHeader) {
    req.user = null;
    req.session = null;
    req.identity = null;
    req.profile = null;

    return next();
  }

  const parts =
    authorizationHeader
      .trim()
      .split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== "bearer" ||
    !parts[1]
  ) {
    req.user = null;
    req.session = null;
    req.identity = null;
    req.profile = null;

    return next();
  }

  try {
    const context =
      await AuthContextService
        .authenticate(parts[1]);

    req.context = {
      ...(req.context ?? {}),
      ...context,
    };

    req.user = context.user;
    req.session = context.session;
    req.identity = context.identity;
    req.profile = context.profile;

    return next();
  } catch {
    /*
     * Optional authentication deliberately treats an
     * invalid, expired, or revoked token as anonymous.
     */
    req.user = null;
    req.session = null;
    req.identity = null;
    req.profile = null;

    return next();
  }
}

export default optionalAuthMiddleware;