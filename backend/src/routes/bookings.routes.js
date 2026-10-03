import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  idParam,
  bookingListQuerySchema,
  createBookingSchema,
  updateBookingSchema,
  checkOutSchema,
} from "../validators/index.js";
import * as bookingsController from "../controllers/bookings.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", validate(bookingListQuerySchema, "query"), bookingsController.list);
router.post("/", validate(createBookingSchema), bookingsController.create);
router.get("/:id", validate(idParam, "params"), bookingsController.getById);
router.patch(
  "/:id",
  authorize("admin", "receptionist"),
  validate(idParam, "params"),
  validate(updateBookingSchema),
  bookingsController.update,
);
router.post("/:id/cancel", validate(idParam, "params"), bookingsController.cancel);
router.post(
  "/:id/check-in",
  authorize("admin", "receptionist"),
  validate(idParam, "params"),
  bookingsController.checkIn,
);
router.post(
  "/:id/check-out",
  authorize("admin", "receptionist"),
  validate(idParam, "params"),
  validate(checkOutSchema),
  bookingsController.checkOut,
);

export default router;
