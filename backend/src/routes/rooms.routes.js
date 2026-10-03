import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  idParam,
  roomListQuerySchema,
  availabilityQuerySchema,
  createRoomSchema,
  updateRoomSchema,
  bulkCreateRoomsSchema,
} from "../validators/index.js";
import * as roomsController from "../controllers/rooms.controller.js";

const router = Router();

router.get("/", validate(roomListQuerySchema, "query"), roomsController.listRooms);
router.get(
  "/availability",
  validate(availabilityQuerySchema, "query"),
  roomsController.getAvailability,
);
router.get("/:id", validate(idParam, "params"), roomsController.getRoom);
router.post(
  "/",
  authenticate,
  authorize("admin"),
  validate(createRoomSchema),
  roomsController.createRoom,
);
router.post(
  "/bulk",
  authenticate,
  authorize("admin"),
  validate(bulkCreateRoomsSchema),
  roomsController.bulkCreateRooms,
);
router.patch(
  "/:id",
  authenticate,
  authorize("admin", "receptionist"),
  validate(idParam, "params"),
  validate(updateRoomSchema),
  roomsController.updateRoom,
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  validate(idParam, "params"),
  roomsController.deleteRoom,
);

export default router;
