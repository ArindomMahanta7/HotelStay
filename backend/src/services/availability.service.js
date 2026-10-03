import { sql, eq, and, ne, inArray, gte, asc, or, ilike } from "drizzle-orm";
import { rooms, roomTypes, bookings, bookingRooms } from "../db/schema/index.js";

export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "checked_in"];

function conflictExists(checkIn, checkOut, roomColumn) {
  return sql`exists (
    select 1
    from ${bookingRooms} br
    inner join ${bookings} b on b.id = br.booking_id
    where br.room_id = ${roomColumn}
      and b.status in ('pending', 'confirmed', 'checked_in')
      and b.check_in < ${checkOut}::date
      and b.check_out > ${checkIn}::date
  )`;
}

export function buildAvailabilityConditions({
  hotelId,
  checkIn,
  checkOut,
  guests,
  roomTypeId,
  roomIds,
}) {
  const conditions = [];

  if (hotelId) conditions.push(eq(rooms.hotelId, hotelId));
  conditions.push(ne(rooms.status, "maintenance"));

  if (roomTypeId) conditions.push(eq(rooms.roomTypeId, roomTypeId));
  if (roomIds?.length) conditions.push(inArray(rooms.id, roomIds));
  if (guests) conditions.push(gte(roomTypes.capacity, guests));
  if (checkIn && checkOut) {
    conditions.push(sql`not ${conflictExists(checkIn, checkOut, rooms.id)}`);
  }

  return conditions;
}

export async function findAvailableRooms(
  dbx,
  { hotelId, checkIn, checkOut, guests, roomTypeId, roomIds } = {},
) {
  const conditions = buildAvailabilityConditions({
    hotelId,
    checkIn,
    checkOut,
    guests,
    roomTypeId,
    roomIds,
  });

  return dbx
    .select({
      id: rooms.id,
      hotelId: rooms.hotelId,
      roomTypeId: rooms.roomTypeId,
      roomNumber: rooms.roomNumber,
      floor: rooms.floor,
      price: rooms.price,
      status: rooms.status,
      capacity: roomTypes.capacity,
      pricePerNight: roomTypes.pricePerNight,
      typeName: roomTypes.name,
      description: roomTypes.description,
      amenities: roomTypes.amenities,
    })
    .from(rooms)
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(and(...conditions))
    .orderBy(asc(rooms.roomNumber));
}

export async function findConflictingBookings(
  dbx,
  { roomIds, checkIn, checkOut, excludeBookingId },
) {
  if (!roomIds?.length) return [];
  const result = await dbx.execute(sql`
    select b.id, b.booking_number, b.status, b.check_in, b.check_out, r.room_number
    from ${bookingRooms} br
    inner join ${bookings} b on b.id = br.booking_id
    inner join ${rooms} r on r.id = br.room_id
    where br.room_id = any(${roomIds}::uuid[])
      and b.status in ('pending', 'confirmed', 'checked_in')
      and b.check_in < ${checkOut}::date
      and b.check_out > ${checkIn}::date
      ${excludeBookingId ? sql`and b.id != ${excludeBookingId}::uuid` : sql``}
    order by b.check_in
  `);
  return result.rows;
}
