import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings.js";

export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card", "upi"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull().default("cash"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    transactionId: varchar("transaction_id", { length: 60 }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payments_booking_idx").on(table.bookingId)],
);
