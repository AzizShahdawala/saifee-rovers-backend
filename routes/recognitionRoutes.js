import express from "express";
import { deepRecognitionHealth, testRecognitionEmbedding } from "../controllers/recognitionController.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = express.Router();

router.get("/deep-health", asyncHandler(deepRecognitionHealth));
router.use(requireAuth, requireRole("admin"));
router.post("/test", asyncHandler(testRecognitionEmbedding));

export default router;
