import { ApiError } from "../utils/errors.js";

const PG_ERROR_MESSAGES = {
  "23505": [409, "Resource already exists"],
  "23503": [400, "Related resource does not exist"],
  "23502": [400, "Missing required field"],
  "23514": [400, "Value violates a database constraint"],
  "22P02": [400, "Invalid value format"],
  "22007": [400, "Invalid date format"],
  "22008": [400, "Invalid date format"],
};

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Malformed JSON body" });
  }

  if (err?.code && PG_ERROR_MESSAGES[err.code]) {
    const [status, message] = PG_ERROR_MESSAGES[err.code];
    return res.status(status).json({
      success: false,
      message: err.constraint ? `${message} (${err.constraint})` : message,
    });
  }

  console.error(err);
  const status = err?.status ?? err?.statusCode ?? 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? "Internal server error" : err.message,
  });
}
