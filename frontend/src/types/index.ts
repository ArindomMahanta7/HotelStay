export type Role = "admin" | "receptionist" | "customer";

export const isStaffRole = (role?: Role | null) => role === "admin" || role === "receptionist";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  createdAt?: string;
}

export type RoomStatus = "available" | "reserved" | "occupied" | "cleaning" | "maintenance";
export type RoomTypeName = "single" | "double" | "deluxe" | "suite";
export type BookingStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled";
export type PaymentMethod = "cash" | "card" | "upi";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type IdType = "passport" | "drivers_license" | "national_id" | "other";

export interface RoomType {
  id: string;
  hotelId: string;
  name: RoomTypeName;
  description?: string | null;
  capacity: number;
  pricePerNight: number;
  amenities?: string[] | null;
  images?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Room {
  id: string;
  hotelId: string;
  roomTypeId: string;
  roomNumber: string;
  floor: number;
  price?: number | null;
  status: RoomStatus;
  createdAt?: string;
  updatedAt?: string;
  roomType?: Partial<RoomType>;
  typeName?: string;
  capacity?: number;
  amenities?: string[] | null;
}

export interface Guest {
  id: string;
  hotelId?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  idType?: IdType | null;
  idNumber?: string | null;
  userId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingRoomItem {
  roomId: string;
  roomNumber: string;
  floor?: number;
  roomType?: string;
  rate: number;
  nights: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string | null;
  paidAt?: string | null;
  createdAt?: string;
}

export interface Bill {
  nights: number;
  items: BookingRoomItem[];
  total: number;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  nights: number;
  numGuests: number;
  totalAmount: number;
  specialRequests?: string | null;
  createdAt: string;
  updatedAt?: string;
  guest: Guest | null;
  user?: Pick<User, "id" | "name" | "email" | "role"> | null;
  rooms: BookingRoomItem[];
  payments: Payment[];
  bill: Bill;
}

export interface AvailableRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  roomTypeId: string;
  typeName: string;
  capacity: number;
  amenities?: string[] | null;
  nightlyRate: number;
  totalForStay: number;
}

export interface AvailabilityResult {
  checkIn: string;
  checkOut: string;
  nights: number;
  count: number;
  rooms: AvailableRoom[];
}