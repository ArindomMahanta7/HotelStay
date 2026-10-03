import { eq, and, or, ilike, sql, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { guests, bookings, bookingRooms, rooms, roomTypes } from "../db/schema/index.js";
import { ApiError } from "../utils/errors.js";
import { validated } from "../middleware/validate.js";

export async function listGuests(req, res) {
  const query = validated(req, "query");
  const conditions = [];

  if (query.q) {
    const like = `%${query.q}%`;
    conditions.push(
      or(
        ilike(guests.name, like),
        ilike(guests.email, like),
        ilike(guests.phone, like),
        ilike(guests.idNumber, like),
      ),
    );
  }

  const rows = await db
    .select()
    .from(guests)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(guests.name))
    .limit(query.limit)
    .offset(query.offset);

  res.json({ success: true, data: rows });
}

export async function getGuest(req, res) {
  const [guest] = await db.select().from(guests).where(eq(guests.id, req.params.id)).limit(1);
  if (!guest) throw ApiError.notFound("Guest not found");

  const history = await db
    .select({
      booking: bookings,
      roomNumber: sql`(
        select coalesce(string_agg(r.room_number, ', '), '')
        from ${bookingRooms} br
        join ${rooms} r on r.id = br.room_id
        where br.booking_id = ${bookings.id}
      )`,
      roomType: sql`(
        select coalesce(string_agg(distinct rt.name::text, ', '), '')
        from ${bookingRooms} br
        join ${rooms} r on r.id = br.room_id
        join ${roomTypes} rt on rt.id = r.room_type_id
        where br.booking_id = ${bookings.id}
      )`,
    })
    .from(bookings)
    .where(eq(bookings.guestId, guest.id))
    .orderBy(sql`${bookings.createdAt} desc`);

  res.json({
    success: true,
    data: {
      ...guest,
      bookingHistory: history.map((row) => ({
        ...row.booking,
        totalAmount: Number(row.booking.totalAmount),
        roomNumber: row.roomNumber,
        roomType: row.roomType,
      })),
    },
  });
}

export async function createGuest(req, res) {
  const body = req.body;
  const [guest] = await db
    .insert(guests)
    .values({
      name: body.name,
      email: body.email || null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      idType: body.idType ?? null,
      idNumber: body.idNumber ?? null,
      userId: body.userId ?? null,
    })
    .returning();

  res.status(201).json({ success: true, data: guest });
}

export async function updateGuest(req, res) {
  const body = req.body;
  const [existing] = await db
    .select({ id: guests.id })
    .from(guests)
    .where(eq(guests.id, req.params.id))
    .limit(1);
  if (!existing) throw ApiError.notFound("Guest not found");

  const updates = {};
  for (const key of ["name", "email", "phone", "address", "idType", "idNumber", "userId"]) {
    if (body[key] !== undefined) updates[key] = body[key] === "" ? null : body[key];
  }

  const [updated] = await db
    .update(guests)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(guests.id, existing.id))
    .returning();

  res.json({ success: true, data: updated });
}
