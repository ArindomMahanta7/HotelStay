import { ApiError } from "../utils/errors.js";

export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || source,
        message: issue.message,
      }));
      return next(ApiError.badRequest("Validation failed", details));
    }

    req.validated = { ...(req.validated ?? {}), [source]: result.data };
    if (source === "body") req.body = result.data;
    next();
  };
}

export function validated(req, source) {
  return req.validated?.[source];
}
