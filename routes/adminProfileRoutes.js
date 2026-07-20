import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { adminProfilePhotoUpload } from "../middleware/upload.js";
import { changeAdminPassword, getAdminProfile, updateAdminProfilePhoto } from "../controllers/adminProfileController.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));
router.get("/me", asyncHandler(getAdminProfile));
router.put("/me/password", asyncHandler(changeAdminPassword));
router.put("/me/photo", adminProfilePhotoUpload.single("photo"), asyncHandler(updateAdminProfilePhoto));
export default router;
