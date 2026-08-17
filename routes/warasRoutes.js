import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth from "../middleware/auth.js";
import { getWaras } from "../controllers/warasController.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", asyncHandler(getWaras));

export default router;
