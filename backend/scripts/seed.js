import { eq, count } from "drizzle-orm";
import { db, closeDb } from "../src/db/index.js";
import {
  users,
  hotels,
  roomTypes,
  rooms,
  guests,
  bookings,
  bookingRooms,
  payments,
} from "../src/db/schema/index.js";
import { hashPassword } from "../src/utils/password.js";
import { todayISO, addDaysISO } from "../src/utils/dates.js";

const DEMO_USERS = [
  {
    name: "Amit Admin",
    email: "admin@hotelstay.com",
    password: "Admin@1234",
    role: "admin",
    phone: "+91-9000000001",
  },
  {
    name: "Riya Reception",
    email: "reception@hotelstay.com",
    password: "Reception@123",
    role: "receptionist",
    phone: "+91-9000000002",
  },
  {
    name: "Carlos Customer",
    email: "customer@hotelstay.com",
    password: "Customer@123",
    role: "customer",
    phone: "+91-9000000003",
  },
];

const ROOM_TYPES = [
  {
    name: "single",
    description: "Cozy room with a single bed, ideal for solo travellers.",
    capacity: 1,
    price: 1500,
    amenities: ["Wi-Fi", "AC", "TV", "Attached Bathroom"],
    images: [],
  },
  {
    name: "double",
    description: "Comfortable room with a double bed for two guests.",
    capacity: 2,
    price: 2500,
    amenities: ["Wi-Fi", "AC", "TV", "Mini Fridge", "Attached Bathroom"],
    images: [],
  },
  {
    name: "deluxe",
    description: "Spacious deluxe room with a king bed and city view.",
    capacity: 3,
    price: 4500,
    amenities: ["Wi-Fi", "AC", "Smart TV", "Mini Bar", "Work Desk", "Sea View"],
    images: [],
  },
  {
    name: "suite",
    description: "Premium suite with separate living area and lounge access.",
    capacity: 5,
    price: 8000,
    amenities: ["Wi-Fi", "AC", "Smart TV", "Mini Bar", "Living Room", "Balcony"],
    images: [],
  },
];

const ROOMS_BY_TYPE = {
  single: { prefix: "1", numbers: ["01", "02", "03", "04"], floor: 1 },
  double: { prefix: "2", numbers: ["01", "02", "03", "04", "05", "06"], floor: 2 },
  deluxe: { prefix: "3", numbers: ["01", "02", "03", "04", "05", "06"], floor: 3 },
  suite: { prefix: "4", numbers: ["01", "02", "03", "04"], floor: 4 },
};

async function ensureUsers() {
  const created = [];
  for (const user of DEMO_USERS) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);
    if (existing) continue;

    const [row] = await db
      .insert(users)
      .values({
        name: user.name,
        email: user.email,
        passwordHash: await hashPassword(user.password),
        role: user.role,
        phone: user.phone,
      })
      .returning();
    created.push(row);
  }
  return created;
}

async function ensureHotel() {
  const [{ value: existing } = {}] = await db
    .select({ value: count() })
    .from(hotels);

  if (existing > 0) {
    const [hotel] = await db.select().from(hotels).limit(1);
    return { hotel, created: false };
  }

  const [hotel] = await db
    .insert(hotels)
    .values({
      name: "HotelStay Grand",
      address: "12 MG Road, Near City Centre",
      city: "Bengaluru",
      phone: "+91-80-40001000",
      email: "stay@hotelstaygrand.com",
    })
    .returning();
  return { hotel, created: true };
}

async function ensureRoomTypes(hotel) {
  const [{ value: existing } = {}] = await db.select({ value: count() }).from(roomTypes);
  if (existing > 0) {
    return db.select().from(roomTypes);
  }

  const inserted = await db
    .insert(roomTypes)
    .values(
      ROOM_TYPES.map((type) => ({
        hotelId: hotel.id,
        name: type.name,
        description: type.description,
        capacity: type.capacity,
        pricePerNight: String(type.price),
        amenities: type.amenities,
        images: type.images,
      })),
    )
    .returning();
  return inserted;
}

async function ensureRooms(hotel, types) {
  const [{ value: existing } = {}] = await db.select({ value: count() }).from(rooms);
  if (existing > 0) return db.select().from(rooms);

  const byName = Object.fromEntries(types.map((type) => [type.name, type]));
  const values = [];

  for (const [name, config] of Object.entries(ROOMS_BY_TYPE)) {
    const type = byName[name];
    if (!type) continue;
    for (const number of config.numbers) {
      values.push({
        hotelId: hotel.id,
        roomTypeId: type.id,
        roomNumber: `${config.prefix}${number}`,
        floor: config.floor,
        price: null,
        status: "available",
      });
    }
  }

  return db.insert(rooms).values(values).returning();
}

async function ensureDemoBookings({ types, roomRows }) {
  const [{ value: existing } = {}] = await db.select({ value: count() }).from(bookings);
  if (existing > 0) return 0;

  const allUsers = await db.select().from(users);
  const customer = allUsers.find((user) => user.role === "customer");
  const receptionist = allUsers.find((user) => user.role === "receptionist");

  const [guest1, guest2] = await db
    .insert(guests)
    .values([
      {
        name: "Carlos Customer",
        email: "customer@hotelstay.com",
        phone: "+91-9000000003",
        address: "42 Palm Street, Goa",
        idType: "passport",
        idNumber: "P1234567",
        userId: customer?.id ?? null,
      },
      {
        name: "Meera Iyer",
        email: "meera@example.com",
        phone: "+91-9876543210",
        address: "8 Lake View, Chennai",
        idType: "national_id",
        idNumber: "AADH1234",
      },
    ])
    .returning();

  const today = todayISO();
  const findRoom = (number) => roomRows.find((room) => room.roomNumber === number);
  const rateOf = (type) => Number(type.pricePerNight);

  const plan = [
    {
      bookingNumber: "HS-SEED001",
      guest: guest1,
      userId: customer?.id ?? null,
      checkIn: addDaysISO(today, 10),
      checkOut: addDaysISO(today, 12),
      numGuests: 1,
      status: "pending",
      room: findRoom("101"),
      type: types.find((t) => t.name === "single"),
      roomStatus: "reserved",
      payment: null,
    },
    {
      bookingNumber: "HS-SEED002",
      guest: guest2,
      userId: receptionist?.id ?? null,
      checkIn: addDaysISO(today, 2),
      checkOut: addDaysISO(today, 5),
      numGuests: 2,
      status: "confirmed",
      room: findRoom("201"),
      type: types.find((t) => t.name === "double"),
      roomStatus: "reserved",
      payment: null,
    },
    {
      bookingNumber: "HS-SEED003",
      guest: guest1,
      userId: customer?.id ?? null,
      checkIn: addDaysISO(today, -1),
      checkOut: addDaysISO(today, 1),
      numGuests: 2,
      status: "checked_in",
      room: findRoom("301"),
      type: types.find((t) => t.name === "deluxe"),
      roomStatus: "occupied",
      payment: null,
    },
    {
      bookingNumber: "HS-SEED004",
      guest: guest2,
      userId: receptionist?.id ?? null,
      checkIn: addDaysISO(today, -3),
      checkOut: today,
      numGuests: 4,
      status: "checked_out",
      room: findRoom("401"),
      type: types.find((t) => t.name === "suite"),
      roomStatus: "cleaning",
      payment: { method: "upi", transactionId: "TXN-SEED-0004" },
    },
  ];

  let created = 0;
  for (const item of plan) {
    if (!item.room || !item.type) continue;

    const nights =
      Math.round(
        (Date.parse(`${item.checkOut}T00:00:00Z`) - Date.parse(`${item.checkIn}T00:00:00Z`)) /
          86400000,
      ) || 1;
    const total = (rateOf(item.type) * nights).toFixed(2);

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: item.bookingNumber,
        guestId: item.guest.id,
        userId: item.userId,
        checkIn: item.checkIn,
        checkOut: item.checkOut,
        numGuests: item.numGuests,
        status: item.status,
        totalAmount: total,
        specialRequests: null,
      })
      .returning();

    await db.insert(bookingRooms).values({
      bookingId: booking.id,
      roomId: item.room.id,
      rate: String(rateOf(item.type)),
    });

    await db
      .update(rooms)
      .set({ status: item.roomStatus, updatedAt: new Date() })
      .where(eq(rooms.id, item.room.id));

    if (item.payment) {
      await db.insert(payments).values({
        bookingId: booking.id,
        amount: total,
        method: item.payment.method,
        status: "paid",
        transactionId: item.payment.transactionId,
        paidAt: new Date(),
      });
    }

    created += 1;
  }

  return created;
}

async function main() {
  console.log("Seeding HotelStay database...");

  const createdUsers = await ensureUsers();
  console.log(`users: ${createdUsers.length} created`);

  const { hotel, created: hotelCreated } = await ensureHotel();
  console.log(`hotel: ${hotel.name} ${hotelCreated ? "(created)" : "(exists)"}`);

  const types = await ensureRoomTypes(hotel);
  console.log(`room types: ${types.length}`);

  const roomRows = await ensureRooms(hotel, types);
  console.log(`rooms: ${roomRows.length}`);

  const bookingsCreated = await ensureDemoBookings({ types, roomRows });
  console.log(`bookings: ${bookingsCreated} created`);

  console.log("\nDemo logins:");
  for (const user of DEMO_USERS) {
    console.log(`  ${user.role.padEnd(13)} ${user.email} / ${user.password}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
