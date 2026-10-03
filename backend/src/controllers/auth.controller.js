import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";
import { ApiError } from "../utils/errors.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signToken } from "../utils/jwt.js";
import { revokeToken } from "../middleware/auth.js";

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}

export async function register(req, res) {
  const { name, email, password, phone } = req.body;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) throw ApiError.conflict("An account with this email already exists");

  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: await hashPassword(password),
      phone: phone ?? null,
      role: "customer",
    })
    .returning();

  res.status(201).json({
    success: true,
    data: { user: publicUser(user), token: signToken(user) },
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  res.json({
    success: true,
    data: { user: publicUser(user), token: signToken(user) },
  });
}

export async function logout(req, res) {
  revokeToken(req.token);
  res.json({ success: true, data: { message: "Logged out" } });
}

export async function updateProfile(req, res) {
  const { name, phone, password, currentPassword } = req.body;

  const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
  if (!user) throw ApiError.notFound("User not found");

  const updates = {};
  if (name) updates.name = name;
  if (phone) updates.phone = phone;

  if (password) {
    if (!currentPassword) {
      throw ApiError.badRequest("currentPassword is required to change your password");
    }
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw ApiError.badRequest("currentPassword is incorrect");
    updates.passwordHash = await hashPassword(password);
  }

  if (Object.keys(updates).length) {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    return res.json({ success: true, data: { user: publicUser(updated) } });
  }

  res.json({ success: true, data: { user: publicUser(user) } });
}
