import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema, profileSchema } from "../validators/index.js";
import * as authController from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", authenticate, authController.logout);
router.patch("/profile", authenticate, validate(profileSchema), authController.updateProfile);

export default router;
