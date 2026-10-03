import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { hotels } from "./hotels.js";
import { roomTypes } from "./room_types.js";
import { rooms } from "./rooms.js";
import { guests } from "./guests.js";
import { bookings } from "./bookings.js";
import { bookingRooms } from "./booking_rooms.js";
import { payments } from "./payments.js";

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  guests: many(guests),
}));

export const hotelsRelations = relations(hotels, ({ many }) => ({
  roomTypes: many(roomTypes),
  rooms: many(rooms),
}));

export const roomTypesRelations = relations(roomTypes, ({ one, many }) => ({
  hotel: one(hotels, {
    fields: [roomTypes.hotelId],
    references: [hotels.id],
  }),
  rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  hotel: one(hotels, { fields: [rooms.hotelId], references: [hotels.id] }),
  roomType: one(roomTypes, {
    fields: [rooms.roomTypeId],
    references: [roomTypes.id],
  }),
  bookingRooms: many(bookingRooms),
}));

export const guestsRelations = relations(guests, ({ one, many }) => ({
  user: one(users, { fields: [guests.userId], references: [users.id] }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  guest: one(guests, { fields: [bookings.guestId], references: [guests.id] }),
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  bookingRooms: many(bookingRooms),
  payments: many(payments),
}));

export const bookingRoomsRelations = relations(bookingRooms, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingRooms.bookingId],
    references: [bookings.id],
  }),
  room: one(rooms, { fields: [bookingRooms.roomId], references: [rooms.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));
