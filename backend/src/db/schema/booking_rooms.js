import { pgTable, uuid, numeric, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { bookings } from "./bookings.js";
import { rooms } from "./rooms.js";

export const bookingRooms = pgTable(
  "booking_rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    rate: numeric("rate", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("booking_rooms_booking_room_uq").on(table.bookingId, table.roomId),
    index("booking_rooms_room_idx").on(table.roomId),
  ],
);
