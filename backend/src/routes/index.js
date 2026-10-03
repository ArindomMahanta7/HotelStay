import { Router } from "express";
import authRoutes from "./auth.routes.js";
import roomTypeRoutes from "./roomTypes.routes.js";
import roomRoutes from "./rooms.routes.js";
import guestRoutes from "./guests.routes.js";
import bookingRoutes from "./bookings.routes.js";
import dashboardRoutes from "./dashboard.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/room-types", roomTypeRoutes);
router.use("/rooms", roomRoutes);
router.use("/guests", guestRoutes);
router.use("/bookings", bookingRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
