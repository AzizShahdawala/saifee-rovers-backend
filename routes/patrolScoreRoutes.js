import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { createPatrolScore, getPatrolScoreboard } from "../controllers/patrolScoreController.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", asyncHandler(getPatrolScoreboard));
router.post("/", requireRole("admin"), asyncHandler(createPatrolScore));

export default router;
