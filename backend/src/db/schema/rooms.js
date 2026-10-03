import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { hotels } from "./hotels.js";
import { roomTypes } from "./room_types.js";

export const roomStatusEnum = pgEnum("room_status", [
  "available",
  "reserved",
  "occupied",
  "cleaning",
  "maintenance",
]);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    hotelId: uuid("hotel_id")
      .notNull()
      .references(() => hotels.id, { onDelete: "cascade" }),
    roomTypeId: uuid("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "restrict" }),
    roomNumber: varchar("room_number", { length: 20 }).notNull(),
    floor: integer("floor").notNull().default(1),
    price: numeric("price", { precision: 10, scale: 2 }),
    status: roomStatusEnum("status").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rooms_hotel_room_number_uq").on(table.hotelId, table.roomNumber),
    index("rooms_room_type_idx").on(table.roomTypeId),
    index("rooms_status_idx").on(table.status),
  ],
);
