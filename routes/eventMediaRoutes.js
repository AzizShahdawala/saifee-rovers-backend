import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { eventMediaUpload } from "../middleware/upload.js";
import { listEventMedia, uploadEventMedia } from "../controllers/eventMediaController.js";

const router = express.Router();
router.use(requireAuth);
router.get("/:eventId", asyncHandler(listEventMedia));
router.post("/:eventId", requireRole("admin"), eventMediaUpload.array("media"), asyncHandler(uploadEventMedia));
export default router;
