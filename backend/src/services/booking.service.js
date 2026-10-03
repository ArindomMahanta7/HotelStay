import crypto from "node:crypto";
import { sql, eq, and, inArray, desc, or, ilike, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  bookings,
  bookingRooms,
  rooms,
  roomTypes,
  guests,
  payments,
} from "../db/schema/index.js";
import { ApiError } from "../utils/errors.js";
import { nightsBetween, todayISO, toISODate } from "../utils/dates.js";
import { findAvailableRooms, findConflictingBookings } from "./availability.service.js";

function generateBookingNumber() {
  return `HS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function conflictPayload(rows) {
  return rows.map((row) => ({
    roomNumber: row.room_number,
    bookingNumber: row.booking_number,
    status: row.status,
    checkIn: row.check_in,
    checkOut: row.check_out,
  }));
}

async function lockRooms(tx, roomIds) {
  const res = await tx.execute(sql`
    select r.id, r.hotel_id, r.room_type_id, r.room_number, r.floor, r.price, r.status,
           rt.capacity, rt.price_per_night, rt.name as type_name
    from rooms r
    inner join room_types rt on rt.id = r.room_type_id
    where r.id = any(${roomIds}::uuid[])
    order by r.room_number
    for update of r
  `);
  return res.rows;
}

async function resolveGuest(tx, { guestId, guest, user }) {
  if (guestId) {
    const [record] = await tx.select().from(guests).where(eq(guests.id, guestId)).limit(1);
    if (!record) throw ApiError.notFound("Guest not found");
    return record;
  }

  if (guest?.name) {
    const [record] = await tx
      .insert(guests)
      .values({ ...guest, userId: user?.id ?? null })
      .returning();
    return record;
  }

  if (user) {
    const [existing] = await tx.select().from(guests).where(eq(guests.userId, user.id)).limit(1);
    if (existing) return existing;
    const [record] = await tx
      .insert(guests)
      .values({ name: user.name, email: user.email, userId: user.id })
      .returning();
    return record;
  }

  throw ApiError.badRequest("Provide guestId or guest details");
}

function rateOf(room) {
  const rate = room.price ?? room.price_per_night ?? room.pricePerNight;
  return Number(rate);
}

export function computeBill(booking, lines) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const items = lines.map((line) => {
    const room = line.room ?? line;
    const rate = Number(line.rate ?? rateOf(room));
    return {
      roomId: line.roomId ?? room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomType: line.roomType?.name ?? room.typeName ?? room.type_name,
      rate,
      nights,
      subtotal: Number((rate * nights).toFixed(2)),
    };
  });
  const total = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  return { nights, items, total };
}

function serializeBooking(record) {
  const bill = computeBill(record, record.bookingRooms ?? []);
  const booking = record.booking ?? record;

  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights: bill.nights,
    numGuests: booking.numGuests,
    totalAmount: Number(booking.totalAmount),
    specialRequests: booking.specialRequests,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    guest: record.guest ?? null,
    user: record.user ?? null,
    rooms: bill.items,
    payments: (record.payments ?? []).map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
    })),
    bill,
  };
}

export async function getBookingById(id, { user } = {}) {
  const record = await db.query.bookings.findFirst({
    where: eq(bookings.id, id),
    with: {
      guest: true,
      user: { columns: { id: true, name: true, email: true, role: true } },
      bookingRooms: {
        with: { room: { with: { roomType: { columns: { name: true } } } } },
      },
      payments: true,
    },
  });

  if (!record) throw ApiError.notFound("Booking not found");
  if (user?.role === "customer" && record.userId !== user.id) {
    throw ApiError.forbidden("You can only access your own bookings");
  }

  return serializeBooking(record);
}

async function loadBookingInTx(tx, id) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) throw ApiError.notFound("Booking not found");

  const lineRows = await tx
    .select({ br: bookingRooms, room: rooms, roomType: roomTypes })
    .from(bookingRooms)
    .innerJoin(rooms, eq(bookingRooms.roomId, rooms.id))
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(eq(bookingRooms.bookingId, id));

  const [guestRecord] = await tx.select().from(guests).where(eq(guests.id, booking.guestId));
  const paymentRows = await tx.select().from(payments).where(eq(payments.bookingId, id));

  return {
    booking,
    guest: guestRecord ?? null,
    lines: lineRows.map((row) => ({
      roomId: row.br.roomId,
      rate: row.br.rate,
      room: { ...row.room, typeName: row.roomType.name },
      roomType: row.roomType,
    })),
    payments: paymentRows,
  };
}

function assertOwnership(user, booking) {
  if (user?.role === "customer" && booking.userId !== user.id) {
    throw ApiError.forbidden("You can only access your own bookings");
  }
}

export async function createBooking({ user, input }) {
  const checkIn = toISODate(input.checkIn);
  const checkOut = toISODate(input.checkOut);
  const numGuests = input.numGuests ?? 1;
  const nights = nightsBetween(checkIn, checkOut);

  if (!Number.isFinite(nights) || nights < 1) {
    throw ApiError.badRequest("check-out must be at least one night after check-in");
  }
  if (checkIn < todayISO()) {
    throw ApiError.badRequest("check-in date cannot be in the past");
  }

  const bookingId = await db.transaction(async (tx) => {
    const guestRecord = await resolveGuest(tx, {
      guestId: input.guestId,
      guest: input.guest,
      user,
    });

    let picked;
    let roomIds;

    if (input.roomIds?.length) {
      roomIds = [...new Set(input.roomIds)];
      const locked = await lockRooms(tx, roomIds);
      if (locked.length !== roomIds.length) {
        throw ApiError.badRequest("One or more selected rooms do not exist");
      }

      const maintenance = locked.filter((room) => room.status === "maintenance");
      if (maintenance.length) {
        throw ApiError.badRequest(
          `Room(s) under maintenance: ${maintenance.map((r) => r.room_number).join(", ")}`,
        );
      }

      const capacity = locked.reduce((sum, room) => sum + Number(room.capacity), 0);
      if (capacity < numGuests) {
        throw ApiError.badRequest(
          `Selected rooms sleep ${capacity} guest(s) but ${numGuests} requested`,
        );
      }

      const conflicts = await findConflictingBookings(tx, { roomIds, checkIn, checkOut });
      if (conflicts.length) {
        throw ApiError.conflict(
          "Room not available for the selected dates",
          conflictPayload(conflicts),
        );
      }

      picked = locked;
    } else if (input.roomTypeId) {
      const [roomType] = await tx
        .select()
        .from(roomTypes)
        .where(eq(roomTypes.id, input.roomTypeId))
        .limit(1);
      if (!roomType) throw ApiError.notFound("Room type not found");

      const available = await findAvailableRooms(tx, {
        checkIn,
        checkOut,
        roomTypeId: input.roomTypeId,
      });

      const sorted = [...available].sort(
        (a, b) => b.capacity - a.capacity || a.roomNumber.localeCompare(b.roomNumber),
      );

      const chosen = [];
      let capacity = 0;
      for (const room of sorted) {
        if (capacity >= numGuests) break;
        chosen.push(room);
        capacity += Number(room.capacity);
      }

      if (!chosen.length) {
        throw ApiError.conflict("No rooms of this type are available for the selected dates");
      }
      if (capacity < numGuests) {
        throw ApiError.conflict(
          `Only ${capacity} guest(s) can be accommodated for the selected dates`,
        );
      }

      roomIds = chosen.map((room) => room.id);
      const locked = await lockRooms(tx, roomIds);
      const conflicts = await findConflictingBookings(tx, { roomIds, checkIn, checkOut });
      if (conflicts.length) {
        throw ApiError.conflict(
          "Room not available for the selected dates",
          conflictPayload(conflicts),
        );
      }
      picked = locked;
    } else {
      throw ApiError.badRequest("Either roomIds or roomTypeId is required");
    }

    const lines = picked.map((room) => ({ roomId: room.id, rate: rateOf(room) }));
    const total = Number(
      lines.reduce((sum, line) => sum + line.rate * nights, 0).toFixed(2),
    );

    const [inserted] = await tx
      .insert(bookings)
      .values({
        bookingNumber: generateBookingNumber(),
        guestId: guestRecord.id,
        userId: user?.id ?? null,
        checkIn,
        checkOut,
        numGuests,
        status: "pending",
        totalAmount: total.toFixed(2),
        specialRequests: input.specialRequests ?? null,
      })
      .returning();

    await tx.insert(bookingRooms).values(
      lines.map((line) => ({
        bookingId: inserted.id,
        roomId: line.roomId,
        rate: line.rate.toFixed(2),
      })),
    );

    await tx.execute(sql`
      update rooms set status = 'reserved', updated_at = now()
      where id = any(${roomIds}::uuid[])
    `);

    return inserted.id;
  });

  return getBookingById(bookingId, { user: { role: "staff" } });
}

export async function listBookings({ user, filters }) {
  const { status, from, to, q, guestId, limit = 20, offset = 0 } = filters;
  const conditions = [];

  if (user.role === "customer") conditions.push(eq(bookings.userId, user.id));
  if (status) conditions.push(eq(bookings.status, status));
  if (guestId) conditions.push(eq(bookings.guestId, guestId));
  if (from) conditions.push(gte(bookings.checkOut, from));
  if (to) conditions.push(lte(bookings.checkIn, to));
  if (q) {
    conditions.push(
      or(ilike(bookings.bookingNumber, `%${q}%`), ilike(guests.name, `%${q}%`)),
    );
  }

  const rows = await db
    .select({ booking: bookings, guest: guests })
    .from(bookings)
    .innerJoin(guests, eq(bookings.guestId, guests.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((row) => row.booking.id);
  if (!ids.length) return [];

  const [lineRows, paymentRows] = await Promise.all([
    db
      .select({ br: bookingRooms, room: rooms, roomType: roomTypes })
      .from(bookingRooms)
      .innerJoin(rooms, eq(bookingRooms.roomId, rooms.id))
      .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
      .where(inArray(bookingRooms.bookingId, ids)),
    db.select().from(payments).where(inArray(payments.bookingId, ids)),
  ]);

  const linesByBooking = new Map();
  for (const row of lineRows) {
    const bucket = linesByBooking.get(row.br.bookingId) ?? [];
    bucket.push({
      roomId: row.br.roomId,
      rate: row.br.rate,
      room: { ...row.room, typeName: row.roomType.name },
      roomType: row.roomType,
    });
    linesByBooking.set(row.br.bookingId, bucket);
  }

  const paymentsByBooking = new Map();
  for (const payment of paymentRows) {
    const bucket = paymentsByBooking.get(payment.bookingId) ?? [];
    bucket.push(payment);
    paymentsByBooking.set(payment.bookingId, bucket);
  }

  return rows.map(({ booking, guest }) =>
    serializeBooking({
      booking,
      guest,
      bookingRooms: linesByBooking.get(booking.id) ?? [],
      payments: paymentsByBooking.get(booking.id) ?? [],
    }),
  );
}

export async function updateBooking({ id, user, input }) {
  const bookingId = await db.transaction(async (tx) => {
    const { booking, lines } = await loadBookingInTx(tx, id);
    assertOwnership(user, booking);

    if (input.status && input.status !== booking.status) {
      if (input.status !== "confirmed") {
        throw ApiError.badRequest(
          "Only transitions to 'confirmed' are allowed here; use /cancel for cancellations",
        );
      }
      if (booking.status !== "pending") {
        throw ApiError.conflict(
          `Cannot confirm a booking in status '${booking.status}'`,
        );
      }
    }

    const newCheckIn = input.checkIn ? toISODate(input.checkIn) : booking.checkIn;
    const newCheckOut = input.checkOut ? toISODate(input.checkOut) : booking.checkOut;
    const newNumGuests = input.numGuests ?? booking.numGuests;
    const datesChanged = newCheckIn !== booking.checkIn || newCheckOut !== booking.checkOut;

    const nights = nightsBetween(newCheckIn, newCheckOut);
    if (!Number.isFinite(nights) || nights < 1) {
      throw ApiError.badRequest("check-out must be at least one night after check-in");
    }

    if (datesChanged && newCheckIn < todayISO()) {
      throw ApiError.badRequest("check-in date cannot be in the past");
    }

    const capacity = lines.reduce(
      (sum, line) => sum + Number(line.roomType.capacity),
      0,
    );
    if (newNumGuests > capacity) {
      throw ApiError.badRequest(
        `Booked rooms sleep ${capacity} guest(s) but ${newNumGuests} requested`,
      );
    }

    if (datesChanged) {
      const roomIds = lines.map((line) => line.roomId);
      const conflicts = await findConflictingBookings(tx, {
        roomIds,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        excludeBookingId: booking.id,
      });
      if (conflicts.length) {
        throw ApiError.conflict(
          "Room not available for the requested dates",
          conflictPayload(conflicts),
        );
      }
    }

    const total = Number(
      lines
        .reduce((sum, line) => sum + Number(line.rate) * nights, 0)
        .toFixed(2),
    );

    const [updated] = await tx
      .update(bookings)
      .set({
        status: input.status ?? booking.status,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        numGuests: newNumGuests,
        specialRequests: input.specialRequests ?? booking.specialRequests,
        totalAmount: total.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id))
      .returning();

    return updated.id;
  });

  return getBookingById(bookingId, { user: { role: "staff" } });
}

export async function cancelBooking({ id, user }) {
  const bookingId = await db.transaction(async (tx) => {
    const { booking, lines } = await loadBookingInTx(tx, id);
    assertOwnership(user, booking);

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw ApiError.conflict(
        `Only pending or confirmed bookings can be cancelled (current: '${booking.status}')`,
      );
    }

    const [updated] = await tx
      .update(bookings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(bookings.id, booking.id),
          inArray(bookings.status, ["pending", "confirmed"]),
        ),
      )
      .returning();

    if (!updated) throw ApiError.conflict("Booking status changed, please retry");

    const roomIds = lines.map((line) => line.roomId);
    if (roomIds.length) {
      await tx.execute(sql`
        update rooms set status = 'available', updated_at = now()
        where id = any(${roomIds}::uuid[]) and status = 'reserved'
      `);
    }

    return booking.id;
  });

  return getBookingById(bookingId, { user: { role: "staff" } });
}

export async function checkInBooking({ id }) {
  const bookingId = await db.transaction(async (tx) => {
    const { booking, lines } = await loadBookingInTx(tx, id);

    if (booking.status !== "confirmed") {
      throw ApiError.conflict(
        `Booking must be confirmed before check-in (current: '${booking.status}')`,
      );
    }

    const [updated] = await tx
      .update(bookings)
      .set({ status: "checked_in", updatedAt: new Date() })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, "confirmed")))
      .returning();
    if (!updated) throw ApiError.conflict("Booking status changed, please retry");

    const roomIds = lines.map((line) => line.roomId);
    if (roomIds.length) {
      await tx.execute(sql`
        update rooms set status = 'occupied', updated_at = now()
        where id = any(${roomIds}::uuid[]) and status in ('reserved', 'available')
      `);
    }

    return booking.id;
  });

  return getBookingById(bookingId, { user: { role: "staff" } });
}

export async function checkOutBooking({ id, payment }) {
  const bookingId = await db.transaction(async (tx) => {
    const { booking, lines } = await loadBookingInTx(tx, id);

    if (booking.status !== "checked_in") {
      throw ApiError.conflict(
        `Only checked-in bookings can be checked out (current: '${booking.status}')`,
      );
    }

    const bill = computeBill(
      { checkIn: booking.checkIn, checkOut: booking.checkOut },
      lines,
    );

    if (payment) {
      if (payment.amount != null && Number(payment.amount) !== bill.total) {
        throw ApiError.badRequest(
          `Payment amount must match the final bill of ${bill.total}`,
        );
      }
      if (payment.transactionId && payment.method === "cash") {
        throw ApiError.badRequest("Cash payments do not have a transaction id");
      }
      if (!payment.transactionId && payment.method !== "cash") {
        throw ApiError.badRequest(`Transaction id is required for ${payment.method} payments`);
      }
    }

    const [updated] = await tx
      .update(bookings)
      .set({ status: "checked_out", updatedAt: new Date() })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, "checked_in")))
      .returning();
    if (!updated) throw ApiError.conflict("Booking status changed, please retry");

    const roomIds = lines.map((line) => line.roomId);
    if (roomIds.length) {
      await tx.execute(sql`
        update rooms set status = 'cleaning', updated_at = now()
        where id = any(${roomIds}::uuid[]) and status = 'occupied'
      `);
    }

    if (payment) {
      await tx.insert(payments).values({
        bookingId: booking.id,
        amount: bill.total.toFixed(2),
        method: payment.method,
        status: "paid",
        transactionId: payment.transactionId ?? null,
        paidAt: new Date(),
      });
    }

    return booking.id;
  });

  return getBookingById(bookingId, { user: { role: "staff" } });
}
