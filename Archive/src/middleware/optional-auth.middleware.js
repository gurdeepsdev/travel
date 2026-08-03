import jwt from "jsonwebtoken";

const optionalAuthMiddleware = (
  req,
  res,
  next,
) => {
  try {
    const authorization =
      req.headers.authorization;

    if (!authorization) {
      req.user = null;
      return next();
    }

    const [scheme, token] =
      authorization.split(" ");

    if (
      scheme !== "Bearer" ||
      !token
    ) {
      req.user = null;
      return next();
    }

    const payload = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
    );

    req.user = {
      id: payload.sub,
      userId: payload.sub,
      sessionId: payload.sid,
    };

    return next();
  } catch {
    /*
     * Optional authentication:
     * invalid or expired token is treated
     * as an anonymous request.
     */
    req.user = null;
    return next();
  }
};

export default optionalAuthMiddleware;