import { sql, eq, asc, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { hotels, rooms, bookings, bookingRooms, payments } from "../db/schema/index.js";
import { todayISO, addDaysISO } from "../utils/dates.js";

function bookingScopeFragment(hotelId) {
  return sql`exists (
    select 1
    from ${bookingRooms} br
    inner join ${rooms} r on r.id = br.room_id
    where br.booking_id = ${bookings.id} and r.hotel_id = ${hotelId}
  )`;
}

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

  const [statusRows, checkInRow, checkOutRow, revenueRow, occupancyRow] =
    await Promise.all([
      db
        .select({ status: rooms.status, count: sql`count(*)::int` })
        .from(rooms)
        .where(eq(rooms.hotelId, hotel.id))
        .groupBy(rooms.status),
      db.execute(sql`
        select count(*)::int as count
        from ${bookings}
        where ${bookingScopeFragment(hotel.id)}
          and ${bookings.checkIn} = ${today}::date
          and ${bookings.status} in ('confirmed', 'checked_in')
      `),
      db.execute(sql`
        select count(*)::int as count
        from ${bookings}
        where ${bookingScopeFragment(hotel.id)}
          and ${bookings.checkOut} = ${today}::date
          and ${bookings.status} in ('checked_in', 'checked_out')
      `),
      db.execute(sql`
        select coalesce(sum(p.amount), 0)::float as total
        from ${payments} p
        inner join ${bookings} b on b.id = p.booking_id
        where p.status = 'paid'
          and p.paid_at::date = ${today}::date
          and ${bookingScopeFragment(hotel.id)}
      `),
      db.execute(sql`
        select
          count(*)::int as total,
          count(*) filter (where status = 'occupied')::int as occupied
        from ${rooms}
        where ${rooms.hotelId} = ${hotel.id}
      `),
    ]);

  const roomCounts = { total: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 };
  for (const row of statusRows) {
    roomCounts[row.status] = row.count;
    roomCounts.total += row.count;
  }

  const occupancy = occupancyRow.rows[0];
  const occupancyRate = occupancy?.total
    ? Math.round((occupancy.occupied / occupancy.total) * 100)
    : 0;

  const [recentBookings, upcomingCheckIns, upcomingCheckOuts] = await Promise.all([
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
        guestName: sql`(select name from guests where guests.id = ${bookings.guestId})`,
      })
      .from(bookings)
      .where(bookingScopeFragment(hotel.id))
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
        guestName: sql`(select name from guests where guests.id = ${bookings.guestId})`,
        roomNumbers: sql`(select coalesce(string_agg(r.room_number, ', '), '') from ${bookingRooms} br join ${rooms} r on r.id = br.room_id where br.booking_id = ${bookings.id})`,
      })
      .from(bookings)
      .where(
        sql`${bookingScopeFragment(hotel.id)}
          and ${bookings.checkIn} >= ${today}::date
          and ${bookings.checkIn} <= ${in7Days}::date
          and ${bookings.status} in ('pending', 'confirmed')`,
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
        guestName: sql`(select name from guests where guests.id = ${bookings.guestId})`,
        roomNumbers: sql`(select coalesce(string_agg(r.room_number, ', '), '') from ${bookingRooms} br join ${rooms} r on r.id = br.room_id where br.booking_id = ${bookings.id})`,
      })
      .from(bookings)
      .where(
        sql`${bookingScopeFragment(hotel.id)}
          and ${bookings.checkOut} >= ${today}::date
          and ${bookings.checkOut} <= ${in7Days}::date
          and ${bookings.status} = 'checked_in'`,
      )
      .orderBy(asc(bookings.checkOut))
      .limit(5),
  ]);

  return {
    hotel: { id: hotel.id, name: hotel.name, city: hotel.city },
    date: today,
    rooms: roomCounts,
    occupancyRate,
    today: {
      checkIns: checkInRow.rows[0]?.count ?? 0,
      checkOuts: checkOutRow.rows[0]?.count ?? 0,
      revenue: Number(revenueRow.rows[0]?.total ?? 0),
    },
    recentBookings: recentBookings.map((row) => ({
      ...row,
      totalAmount: Number(row.totalAmount),
    })),
    upcomingCheckIns,
    upcomingCheckOuts,
  };
}
