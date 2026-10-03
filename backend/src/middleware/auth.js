import { verifyToken } from "../utils/jwt.js";
import { ApiError } from "../utils/errors.js";

const revokedTokens = new Set();

function extractToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

export function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized("Authentication required");
    if (revokedTokens.has(token)) throw ApiError.unauthorized("Token has been revoked");

    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      name: payload.name,
      email: payload.email,
    };
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized("Authentication required"));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires one of: ${roles.join(", ")}`));
    }
    next();
  };
}

export function revokeToken(token) {
  if (token) revokedTokens.add(token);
}
