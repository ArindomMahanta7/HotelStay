import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config.js";
import { ApiError } from "./errors.js";

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      jti: crypto.randomUUID(),
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized("Invalid or expired token");
  }
}
