import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { dashboard } from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/", authenticate, authorize("admin", "receptionist"), dashboard);

export default router;
