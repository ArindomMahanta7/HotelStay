import { validated } from "../middleware/validate.js";
import {
  createBooking,
  listBookings,
  getBookingById,
  updateBooking,
  cancelBooking,
  checkInBooking,
  checkOutBooking,
} from "../services/booking.service.js";

export async function list(req, res) {
  const filters = validated(req, "query");
  const data = await listBookings({ user: req.user, filters });
  res.json({
    success: true,
    data,
    meta: { limit: filters.limit, offset: filters.offset, count: data.length },
  });
}

export async function getById(req, res) {
  const booking = await getBookingById(req.params.id, { user: req.user });
  res.json({ success: true, data: booking });
}

export async function create(req, res) {
  const booking = await createBooking({ user: req.user, input: req.body });
  res.status(201).json({ success: true, data: booking });
}

export async function update(req, res) {
  const booking = await updateBooking({
    id: req.params.id,
    user: req.user,
    input: req.body,
  });
  res.json({ success: true, data: booking });
}

export async function cancel(req, res) {
  const booking = await cancelBooking({ id: req.params.id, user: req.user });
  res.json({ success: true, data: booking });
}

export async function checkIn(req, res) {
  const booking = await checkInBooking({ id: req.params.id });
  res.json({ success: true, data: booking });
}

export async function checkOut(req, res) {
  const { payment } = validated(req, "body") ?? {};
  const booking = await checkOutBooking({ id: req.params.id, payment });
  res.json({ success: true, data: booking });
}
