import express from "express";
import upload from "../middleware/upload.js";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { deleteMember, enrollMemberFace, getMember, listMembers, registerMember, updateMember } from "../controllers/memberController.js";

const router = express.Router();
router.get("/", asyncHandler(listMembers));
router.get("/:id", asyncHandler(getMember));
router.post("/register", upload.array("images", 5), asyncHandler(registerMember));
router.put("/:id/face-enrollment", requireAuth, requireRole("admin"), upload.array("images", 5), asyncHandler(enrollMemberFace));
router.put("/:id", asyncHandler(updateMember));
router.delete("/:id", asyncHandler(deleteMember));
export default router;
