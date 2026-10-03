import { pgEnum, pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "receptionist", "customer"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("customer"),
  phone: varchar("phone", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
