import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { hotels } from "./hotels.js";

export const roomTypeNameEnum = pgEnum("room_type_name", [
  "single",
  "double",
  "deluxe",
  "suite",
]);

export const roomTypes = pgTable("room_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  hotelId: uuid("hotel_id")
    .notNull()
    .references(() => hotels.id, { onDelete: "cascade" }),
  name: roomTypeNameEnum("name").notNull(),
  description: text("description"),
  capacity: integer("capacity").notNull().default(2),
  pricePerNight: numeric("price_per_night", { precision: 10, scale: 2 }).notNull(),
  amenities: text("amenities").array().notNull().default([]),
  images: text("images").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
