import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { getBirthdays } from "../controllers/birthdayController.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));
router.get("/", asyncHandler(getBirthdays));

export default router;
