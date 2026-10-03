import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const idParam = z.object({
  id: z.string().regex(UUID, "Invalid id"),
});

const date = z.string().regex(DATE, "Must be a YYYY-MM-DD date");
const positiveAmount = z.coerce.number().nonnegative("Must be 0 or greater");

/* ------------------------------- auth ------------------------------- */

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.email("Invalid email").max(160),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  phone: z.string().min(5).max(30).optional(),
});

export const loginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const profileSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    phone: z.string().min(5).max(30).optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72)
      .optional(),
    currentPassword: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

/* ---------------------------- room types ---------------------------- */

export const createRoomTypeSchema = z.object({
  hotelId: z.uuid().optional(),
  name: z.enum(["single", "double", "deluxe", "suite"]),
  description: z.string().max(2000).optional(),
  capacity: z.coerce.number().int().min(1).max(12).default(2),
  pricePerNight: positiveAmount,
  amenities: z.array(z.string().max(120)).max(50).optional(),
  images: z.array(z.string().max(500)).max(30).optional(),
});

export const updateRoomTypeSchema = createRoomTypeSchema.partial();

/* ------------------------------- rooms ------------------------------ */

export const createRoomSchema = z.object({
  hotelId: z.uuid().optional(),
  roomTypeId: z.uuid("Invalid room type id"),
  roomNumber: z.string().min(1).max(20),
  floor: z.coerce.number().int().min(-5).max(200).default(1),
  price: positiveAmount.nullish(),
  status: z.enum(["available", "reserved", "occupied", "cleaning", "maintenance"]).optional(),
});

export const updateRoomSchema = createRoomSchema
  .omit({ hotelId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const bulkCreateRoomsSchema = z.object({
  hotelId: z.uuid().optional(),
  roomTypeId: z.uuid("Invalid room type id"),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  rooms: z
    .array(
      z.object({
        roomNumber: z.string().min(1).max(20),
        floor: z.coerce.number().int().min(-5).max(200).optional(),
        price: positiveAmount.nullish(),
        status: z
          .enum(["available", "reserved", "occupied", "cleaning", "maintenance"])
          .optional(),
      }),
    )
    .min(1)
    .max(200),
});

export const roomListQuerySchema = z.object({
  hotelId: z.uuid().optional(),
  roomTypeId: z.uuid().optional(),
  status: z.enum(["available", "reserved", "occupied", "cleaning", "maintenance"]).optional(),
  floor: z.coerce.number().int().optional(),
  q: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const availabilityQuerySchema = z
  .object({
    checkIn: date,
    checkOut: date,
    guests: z.coerce.number().int().min(1).optional(),
    roomTypeId: z.uuid().optional(),
    hotelId: z.uuid().optional(),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: "check-out must be after check-in",
    path: ["checkOut"],
  });

/* ------------------------------ guests ------------------------------ */

export const createGuestSchema = z.object({
  name: z.string().min(2).max(120),
  email: z
    .union([z.email("Invalid email").max(160), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  phone: z.string().min(5).max(30).optional(),
  address: z.string().max(500).optional(),
  idType: z.enum(["passport", "drivers_license", "national_id", "other"]).optional(),
  idNumber: z.string().max(60).optional(),
  userId: z.uuid().optional(),
});

export const updateGuestSchema = createGuestSchema
  .omit({ userId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const guestListQuerySchema = z.object({
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/* ----------------------------- bookings ----------------------------- */

export const embeddedGuestSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.email("Invalid email").max(160).optional(),
  phone: z.string().min(5).max(30).optional(),
  address: z.string().max(500).optional(),
  idType: z.enum(["passport", "drivers_license", "national_id", "other"]).optional(),
  idNumber: z.string().max(60).optional(),
});

export const createBookingSchema = z
  .object({
    checkIn: date,
    checkOut: date,
    numGuests: z.coerce.number().int().min(1).max(50).default(1),
    roomIds: z.array(z.uuid()).min(1).max(20).optional(),
    roomTypeId: z.uuid().optional(),
    guestId: z.uuid().optional(),
    guest: embeddedGuestSchema.optional(),
    specialRequests: z.string().max(1000).optional(),
  })
  .refine((data) => data.roomIds?.length || data.roomTypeId, {
    message: "Provide roomIds or roomTypeId",
    path: ["roomIds"],
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: "check-out must be after check-in",
    path: ["checkOut"],
  });

export const updateBookingSchema = z
  .object({
    status: z.enum(["confirmed"]).optional(),
    checkIn: date.optional(),
    checkOut: date.optional(),
    numGuests: z.coerce.number().int().min(1).max(50).optional(),
    specialRequests: z.string().max(1000).nullish(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

export const bookingListQuerySchema = z.object({
  status: z.enum(["pending", "confirmed", "checked_in", "checked_out", "cancelled"]).optional(),
  from: date.optional(),
  to: date.optional(),
  q: z.string().max(120).optional(),
  guestId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const checkOutSchema = z.object({
  payment: z
    .object({
      method: z.enum(["cash", "card", "upi"]),
      amount: positiveAmount.optional(),
      transactionId: z.string().min(4).max(60).optional(),
    })
    .optional(),
});
