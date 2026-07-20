import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { createPatrolScore, getPatrolScoreboard } from "../controllers/patrolScoreController.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));
router.get("/", asyncHandler(getPatrolScoreboard));
router.post("/", asyncHandler(createPatrolScore));

export default router;
