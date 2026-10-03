import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  idParam,
  guestListQuerySchema,
  createGuestSchema,
  updateGuestSchema,
} from "../validators/index.js";
import * as guestsController from "../controllers/guests.controller.js";

const router = Router();

router.use(authenticate, authorize("admin", "receptionist"));

router.get("/", validate(guestListQuerySchema, "query"), guestsController.listGuests);
router.get("/:id", validate(idParam, "params"), guestsController.getGuest);
router.post("/", validate(createGuestSchema), guestsController.createGuest);
router.patch("/:id", validate(idParam, "params"), validate(updateGuestSchema), guestsController.updateGuest);

export default router;
