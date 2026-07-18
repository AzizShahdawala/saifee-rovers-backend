import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { profilePhotoUpload } from "../middleware/upload.js";
import { changeMemberPassword, getMemberAttendance, getMemberDashboard, getMemberEvents, getMemberProfile, updateMemberProfilePhoto } from "../controllers/memberPortalController.js";

const router = express.Router();
router.use(requireAuth, requireRole("member"));
router.get("/me", asyncHandler(getMemberProfile));
router.put("/me/password", asyncHandler(changeMemberPassword));
router.put("/me/photo", profilePhotoUpload.single("photo"), asyncHandler(updateMemberProfilePhoto));
router.get("/dashboard", asyncHandler(getMemberDashboard));
router.get("/attendance", asyncHandler(getMemberAttendance));
router.get("/events", asyncHandler(getMemberEvents));
export default router;
