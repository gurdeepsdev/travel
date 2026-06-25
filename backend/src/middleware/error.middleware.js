import { errorResponse } from "../core/response/api-response.js";

export default function errorMiddleware(
  err,
  req,
  res,
  next
) {
  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json(
    errorResponse(
      err.code || "INTERNAL_ERROR",
      err.message || "Internal Server Error"
    )
  );
}