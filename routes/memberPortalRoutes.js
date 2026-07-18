import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { getMemberAttendance, getMemberDashboard, getMemberEvents, getMemberProfile } from "../controllers/memberPortalController.js";

const router = express.Router();
router.use(requireAuth, requireRole("member"));
router.get("/me", asyncHandler(getMemberProfile));
router.get("/dashboard", asyncHandler(getMemberDashboard));
router.get("/attendance", asyncHandler(getMemberAttendance));
router.get("/events", asyncHandler(getMemberEvents));
export default router;
