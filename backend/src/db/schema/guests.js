import { pgEnum, pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const idTypeEnum = pgEnum("id_type", [
  "passport",
  "drivers_license",
  "national_id",
  "other",
]);

export const guests = pgTable("guests", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }),
  phone: varchar("phone", { length: 30 }),
  address: text("address"),
  idType: idTypeEnum("id_type"),
  idNumber: varchar("id_number", { length: 60 }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
