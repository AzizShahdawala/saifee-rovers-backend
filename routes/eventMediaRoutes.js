import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { eventMediaUpload } from "../middleware/upload.js";
import { deleteAllEventMedia, listEventMedia, listGalleryMedia, streamEventMedia, uploadEventMedia } from "../controllers/eventMediaController.js";

const router = express.Router();
router.get("/file/:mediaId", asyncHandler(streamEventMedia));
router.get("/file/:mediaId/download", asyncHandler(streamEventMedia));
router.use(requireAuth);
router.get("/", asyncHandler(listGalleryMedia));
router.delete("/", requireRole("admin"), asyncHandler(deleteAllEventMedia));
router.get("/:eventId", asyncHandler(listEventMedia));
router.post("/:eventId", requireRole("admin"), eventMediaUpload.array("media"), asyncHandler(uploadEventMedia));
export default router;
