import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const hotels = pgTable("hotels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 160 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
