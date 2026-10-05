import { eq, and, sql, asc, ilike, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { rooms, roomTypes, bookingRooms } from "../db/schema/index.js";
import { ApiError } from "../utils/errors.js";
import { getDefaultHotelId } from "../services/hotel.service.js";
import { findAvailableRooms } from "../services/availability.service.js";
import { validated } from "../middleware/validate.js";

export async function listRooms(req, res) {
  const query = validated(req, "query");
  const conditions = [];

  if (query.hotelId) conditions.push(eq(rooms.hotelId, query.hotelId));
  if (query.roomTypeId) conditions.push(eq(rooms.roomTypeId, query.roomTypeId));
  if (query.status) conditions.push(eq(rooms.status, query.status));
  if (query.floor !== undefined) conditions.push(eq(rooms.floor, query.floor));
  if (query.q) conditions.push(ilike(rooms.roomNumber, `%${query.q}%`));

  const rows = await db
    .select({ room: rooms, roomType: roomTypes })
    .from(rooms)
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(rooms.floor), asc(rooms.roomNumber))
    .limit(query.limit)
    .offset(query.offset);

  res.json({
    success: true,
    data: rows.map((row) => ({
      ...row.room,
      price: row.room.price !== null ? Number(row.room.price) : null,
      roomType: {
        id: row.roomType.id,
        name: row.roomType.name,
        capacity: row.roomType.capacity,
        pricePerNight: Number(row.roomType.pricePerNight),
        amenities: row.roomType.amenities,
      },
    })),
  });
}

export async function getAvailability(req, res) {
  const query = validated(req, "query");
  const hotelId = query.hotelId ?? (await getDefaultHotelId());

  const available = await findAvailableRooms(db, {
    hotelId,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    guests: query.guests,
    roomTypeId: query.roomTypeId,
  });

  const nights = Math.round(
    (Date.parse(`${query.checkOut}T00:00:00Z`) - Date.parse(`${query.checkIn}T00:00:00Z`)) /
      86400000,
  );

  res.json({
    success: true,
    data: {
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      nights,
      count: available.length,
      rooms: available.map((room) => ({
        id: room.id,
        roomNumber: room.roomNumber,
        floor: room.floor,
        status: room.status,
        roomTypeId: room.roomTypeId,
        typeName: room.typeName,
        capacity: room.capacity,
        amenities: room.amenities,
        nightlyRate: Number(room.price ?? room.pricePerNight),
        totalForStay: Number(((room.price ?? room.pricePerNight) * nights).toFixed(2)),
      })),
    },
  });
}

export async function getRoom(req, res) {
  const [row] = await db
    .select({ room: rooms, roomType: roomTypes })
    .from(rooms)
    .innerJoin(roomTypes, eq(rooms.roomTypeId, roomTypes.id))
    .where(eq(rooms.id, req.params.id))
    .limit(1);
  if (!row) throw ApiError.notFound("Room not found");

  res.json({
    success: true,
    data: {
      ...row.room,
      price: row.room.price !== null ? Number(row.room.price) : null,
      roomType: row.roomType,
    },
  });
}

export async function createRoom(req, res) {
  const body = req.body;
  const hotelId = body.hotelId ?? (await getDefaultHotelId());
  if (!hotelId) throw ApiError.badRequest("No hotel found. Create a hotel first.");

  const [roomType] = await db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(eq(roomTypes.id, body.roomTypeId))
    .limit(1);
  if (!roomType) throw ApiError.notFound("Room type not found");

  const [existingRoom] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.hotelId, hotelId), eq(rooms.roomNumber, body.roomNumber)))
    .limit(1);
  if (existingRoom) {
    throw ApiError.conflict(`Room number ${body.roomNumber} already exists in this hotel.`);
  }

  const [room] = await db
    .insert(rooms)
    .values({
      hotelId,
      roomTypeId: body.roomTypeId,
      roomNumber: body.roomNumber,
      floor: body.floor,
      price: body.price != null ? String(body.price) : null,
      status: body.status ?? "available",
    })
    .returning();

  res.status(201).json({ success: true, data: { ...room, price: room.price && Number(room.price) } });
}

export async function updateRoom(req, res) {
  const body = req.body;
  const [existing] = await db
    .select({ id: rooms.id, hotelId: rooms.hotelId, roomNumber: rooms.roomNumber })
    .from(rooms)
    .where(eq(rooms.id, req.params.id))
    .limit(1);
  if (!existing) throw ApiError.notFound("Room not found");

  if (body.roomTypeId) {
    const [roomType] = await db
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(eq(roomTypes.id, body.roomTypeId))
      .limit(1);
    if (!roomType) throw ApiError.notFound("Room type not found");
  }

  if (body.roomNumber !== undefined && body.roomNumber !== existing.roomNumber) {
    const [duplicateRoom] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.hotelId, existing.hotelId), eq(rooms.roomNumber, body.roomNumber)))
      .limit(1);
    if (duplicateRoom) {
      throw ApiError.conflict(`Room number ${body.roomNumber} already exists in this hotel.`);
    }
  }

  const updates = {};
  if (body.roomNumber !== undefined) updates.roomNumber = body.roomNumber;
  if (body.floor !== undefined) updates.floor = body.floor;
  if (body.roomTypeId !== undefined) updates.roomTypeId = body.roomTypeId;
  if (body.price !== undefined) updates.price = body.price != null ? String(body.price) : null;
  if (body.status !== undefined) updates.status = body.status;

  const [updated] = await db
    .update(rooms)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(rooms.id, existing.id))
    .returning();

  res.json({ success: true, data: { ...updated, price: updated.price && Number(updated.price) } });
}

export async function deleteRoom(req, res) {
  const [existingBooking] = await db
    .select({ roomId: bookingRooms.roomId })
    .from(bookingRooms)
    .where(eq(bookingRooms.roomId, req.params.id))
    .limit(1);

  if (existingBooking) {
    throw ApiError.conflict("Cannot delete room because it is associated with existing bookings.");
  }

  const deleted = await db
    .delete(rooms)
    .where(eq(rooms.id, req.params.id))
    .returning();
  if (!deleted.length) throw ApiError.notFound("Room not found");

  res.json({ success: true, data: { id: deleted[0].id, deleted: true } });
}

export async function bulkCreateRooms(req, res) {
  const body = req.body;
  const hotelId = body.hotelId ?? (await getDefaultHotelId());
  if (!hotelId) throw ApiError.badRequest("No hotel found. Create a hotel first.");

  const [roomType] = await db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(eq(roomTypes.id, body.roomTypeId))
    .limit(1);
  if (!roomType) throw ApiError.notFound("Room type not found");

  const roomNumbers = body.rooms.map((r) => r.roomNumber);
  const existingRooms = await db
    .select({ roomNumber: rooms.roomNumber })
    .from(rooms)
    .where(and(eq(rooms.hotelId, hotelId), inArray(rooms.roomNumber, roomNumbers)));
  
  if (existingRooms.length > 0) {
    const duplicates = existingRooms.map(r => r.roomNumber).join(", ");
    throw ApiError.conflict(`The following room numbers already exist in this hotel: ${duplicates}`);
  }

  const values = body.rooms.map((room) => ({
    hotelId,
    roomTypeId: body.roomTypeId,
    roomNumber: room.roomNumber,
    floor: room.floor ?? body.floor ?? 1,
    price: room.price != null ? String(room.price) : null,
    status: room.status ?? "available",
  }));

  const created = await db.insert(rooms).values(values).returning();
  res.status(201).json({ success: true, data: created });
}
