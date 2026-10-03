import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  date,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { guests } from "./guests.js";

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingNumber: varchar("booking_number", { length: 24 }).notNull().unique(),
    guestId: uuid("guest_id")
      .notNull()
      .references(() => guests.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),
    numGuests: integer("num_guests").notNull().default(1),
    status: bookingStatusEnum("status").notNull().default("pending"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    specialRequests: text("special_requests"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bookings_status_idx").on(table.status),
    index("bookings_checkin_idx").on(table.checkIn),
    index("bookings_guest_idx").on(table.guestId),
  ],
);
