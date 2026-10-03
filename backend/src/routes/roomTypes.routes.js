import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  idParam,
  createRoomTypeSchema,
  updateRoomTypeSchema,
} from "../validators/index.js";
import * as roomTypesController from "../controllers/roomTypes.controller.js";

const router = Router();

router.get("/", roomTypesController.listRoomTypes);
router.get("/:id", validate(idParam, "params"), roomTypesController.getRoomType);
router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(createRoomTypeSchema),
  roomTypesController.createRoomType,
);
router.patch(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(idParam, "params"),
  validate(updateRoomTypeSchema),
  roomTypesController.updateRoomType,
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(idParam, "params"),
  roomTypesController.deleteRoomType,
);

export default router;
