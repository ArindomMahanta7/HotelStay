import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { roomTypes, rooms } from "../db/schema/index.js";
import { ApiError } from "../utils/errors.js";
import { getDefaultHotelId } from "../services/hotel.service.js";

export async function listRoomTypes(req, res) {
  const rows = await db
    .select({
      type: roomTypes,
      roomCount: sql`coalesce((select count(*)::int from ${rooms} where ${rooms.roomTypeId} = ${roomTypes.id}), 0)`,
    })
    .from(roomTypes)
    .orderBy(roomTypes.name);

  res.json({
    success: true,
    data: rows.map((row) => ({ ...row.type, roomCount: row.roomCount })),
  });
}

export async function getRoomType(req, res) {
  const [type] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.id, req.params.id))
    .limit(1);
  if (!type) throw ApiError.notFound("Room type not found");

  res.json({ success: true, data: type });
}

export async function createRoomType(req, res) {
  const body = req.body;
  const hotelId = body.hotelId ?? (await getDefaultHotelId());
  if (!hotelId) throw ApiError.badRequest("No hotel found. Create a hotel first.");

  const [type] = await db
    .insert(roomTypes)
    .values({
      hotelId,
      name: body.name,
      description: body.description ?? null,
      capacity: body.capacity,
      pricePerNight: String(body.pricePerNight),
      amenities: body.amenities ?? [],
      images: body.images ?? [],
    })
    .returning();

  res.status(201).json({ success: true, data: type });
}

export async function updateRoomType(req, res) {
  const body = req.body;
  const [existing] = await db
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(eq(roomTypes.id, req.params.id))
    .limit(1);
  if (!existing) throw ApiError.notFound("Room type not found");

  const updates = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.capacity !== undefined) updates.capacity = body.capacity;
  if (body.pricePerNight !== undefined) updates.pricePerNight = String(body.pricePerNight);
  if (body.amenities !== undefined) updates.amenities = body.amenities;
  if (body.images !== undefined) updates.images = body.images;
  if (body.hotelId !== undefined) updates.hotelId = body.hotelId;

  const [updated] = await db
    .update(roomTypes)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(roomTypes.id, existing.id))
    .returning();

  res.json({ success: true, data: updated });
}

export async function deleteRoomType(req, res) {
  const deleted = await db
    .delete(roomTypes)
    .where(eq(roomTypes.id, req.params.id))
    .returning();
  if (!deleted.length) throw ApiError.notFound("Room type not found");

  res.json({ success: true, data: { id: deleted[0].id, deleted: true } });
}
