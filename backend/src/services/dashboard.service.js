import { sql, eq, and, asc, desc, gte, lte, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { hotels, rooms, bookings, bookingRooms, guests, payments } from "../db/schema/index.js";
import { todayISO, addDaysISO } from "../utils/dates.js";

/** Returns IDs of bookings that have at least one room in the given hotel. */
async function getBookingIdsForHotel(hotelId) {
  const rows = await db
    .selectDistinct({ bookingId: bookingRooms.bookingId })
    .from(bookingRooms)
    .innerJoin(rooms, eq(bookingRooms.roomId, rooms.id))
    .where(eq(rooms.hotelId, hotelId));
  return rows.map((r) => r.bookingId);
}

/** Correlated subquery: guest name for a booking row */
const guestNameSubq = sql`(
  select g.name
  from guests g
  where g.id = bookings.guest_id
  limit 1
)`;

/** Correlated subquery: comma-joined room numbers for a booking row */
const roomNumbersSubq = sql`(
  select coalesce(string_agg(r.room_number, ', '), '')
  from booking_rooms br
  join rooms r on r.id = br.room_id
  where br.booking_id = bookings.id
)`;

export async function getDashboard() {
  const [hotel] = await db.select().from(hotels).orderBy(asc(hotels.createdAt)).limit(1);
  const today = todayISO();
  const in7Days = addDaysISO(today, 7);

  if (!hotel) {
    return {
      hotel: null,
      date: today,
      rooms: { total: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 },
      occupancyRate: 0,
      today: { checkIns: 0, checkOuts: 0, revenue: 0 },
      recentBookings: [],
      upcomingCheckIns: [],
      upcomingCheckOuts: [],
    };
  }

  // Room status counts
  const statusRows = await db
    .select({ status: rooms.status, count: sql`count(*)::int` })
    .from(rooms)
    .where(eq(rooms.hotelId, hotel.id))
    .groupBy(rooms.status);

  const roomCounts = { total: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 };
  for (const row of statusRows) {
    roomCounts[row.status] = row.count;
    roomCounts.total += row.count;
  }
  const occupancyRate = roomCounts.total
    ? Math.round((roomCounts.occupied / roomCounts.total) * 100)
    : 0;

  // All booking IDs that belong to this hotel
  const hotelBookingIds = await getBookingIdsForHotel(hotel.id);

  let todayCheckIns = 0;
  let todayCheckOuts = 0;
  let todayRevenue = 0;
  let recentRows = [];
  let upcomingCheckIns = [];
  let upcomingCheckOuts = [];

  if (hotelBookingIds.length) {
    const [checkInRows, checkOutRows, revenueRows] = await Promise.all([
      db
        .select({ count: sql`count(*)::int` })
        .from(bookings)
        .where(
          and(
            inArray(bookings.id, hotelBookingIds),
            eq(bookings.checkIn, today),
            inArray(bookings.status, ["confirmed", "checked_in"]),
          ),
        ),
      db
        .select({ count: sql`count(*)::int` })
        .from(bookings)
        .where(
          and(
            inArray(bookings.id, hotelBookingIds),
            eq(bookings.checkOut, today),
            inArray(bookings.status, ["checked_in", "checked_out"]),
          ),
        ),
      db
        .select({ total: sql`coalesce(sum(${payments.amount}), 0)::float` })
        .from(payments)
        .where(
          and(
            inArray(payments.bookingId, hotelBookingIds),
            eq(payments.status, "paid"),
            sql`${payments.paidAt}::date = ${today}::date`,
          ),
        ),
    ]);

    todayCheckIns = checkInRows[0]?.count ?? 0;
    todayCheckOuts = checkOutRows[0]?.count ?? 0;
    todayRevenue = Number(revenueRows[0]?.total ?? 0);

    [recentRows, upcomingCheckIns, upcomingCheckOuts] = await Promise.all([
      db
        .select({
          id: bookings.id,
          bookingNumber: bookings.bookingNumber,
          status: bookings.status,
          checkIn: bookings.checkIn,
          checkOut: bookings.checkOut,
          numGuests: bookings.numGuests,
          totalAmount: bookings.totalAmount,
          createdAt: bookings.createdAt,
          guestName: guestNameSubq,
        })
        .from(bookings)
        .where(inArray(bookings.id, hotelBookingIds))
        .orderBy(desc(bookings.createdAt))
        .limit(5),

      db
        .select({
          id: bookings.id,
          bookingNumber: bookings.bookingNumber,
          status: bookings.status,
          checkIn: bookings.checkIn,
          checkOut: bookings.checkOut,
          numGuests: bookings.numGuests,
          guestName: guestNameSubq,
          roomNumbers: roomNumbersSubq,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.id, hotelBookingIds),
            gte(bookings.checkIn, today),
            lte(bookings.checkIn, in7Days),
            inArray(bookings.status, ["pending", "confirmed"]),
          ),
        )
        .orderBy(asc(bookings.checkIn))
        .limit(5),

      db
        .select({
          id: bookings.id,
          bookingNumber: bookings.bookingNumber,
          status: bookings.status,
          checkIn: bookings.checkIn,
          checkOut: bookings.checkOut,
          numGuests: bookings.numGuests,
          guestName: guestNameSubq,
          roomNumbers: roomNumbersSubq,
        })
        .from(bookings)
        .where(
          and(
            inArray(bookings.id, hotelBookingIds),
            gte(bookings.checkOut, today),
            lte(bookings.checkOut, in7Days),
            eq(bookings.status, "checked_in"),
          ),
        )
        .orderBy(asc(bookings.checkOut))
        .limit(5),
    ]);
  }

  return {
    hotel: { id: hotel.id, name: hotel.name, city: hotel.city },
    date: today,
    rooms: roomCounts,
    occupancyRate,
    today: {
      checkIns: todayCheckIns,
      checkOuts: todayCheckOuts,
      revenue: todayRevenue,
    },
    recentBookings: recentRows.map((row) => ({
      ...row,
      totalAmount: Number(row.totalAmount),
    })),
    upcomingCheckIns,
    upcomingCheckOuts,
  };
}
