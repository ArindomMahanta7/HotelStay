import { asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { hotels } from "../db/schema/index.js";

export async function getDefaultHotelId() {
  const [hotel] = await db
    .select({ id: hotels.id })
    .from(hotels)
    .orderBy(asc(hotels.createdAt))
    .limit(1);
  return hotel?.id ?? null;
}
