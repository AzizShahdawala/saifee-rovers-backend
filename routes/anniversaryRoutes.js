import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth from "../middleware/auth.js";
import { getAnniversaries } from "../controllers/anniversaryController.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", asyncHandler(getAnniversaries));
export default router;
