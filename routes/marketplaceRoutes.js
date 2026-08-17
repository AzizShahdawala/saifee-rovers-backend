import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth from "../middleware/auth.js";
import { marketplaceMediaUpload } from "../middleware/upload.js";
import { addMarketplaceComment, createMarketplaceListing, deleteMarketplaceComment, getMarketplaceListing, listMarketplace, streamMarketplaceListingMedia, updateMarketplaceStatus } from "../controllers/marketplaceController.js";

const router = express.Router();
router.get("/:id/media/:mediaId", asyncHandler(streamMarketplaceListingMedia));
router.use(requireAuth);
router.get("/", asyncHandler(listMarketplace));
router.post("/", marketplaceMediaUpload.array("media"), asyncHandler(createMarketplaceListing));
router.get("/:id", asyncHandler(getMarketplaceListing));
router.post("/:id/comments", asyncHandler(addMarketplaceComment));
router.delete("/:id/comments/:commentId", asyncHandler(deleteMarketplaceComment));
router.patch("/:id/status", asyncHandler(updateMarketplaceStatus));
export default router;
