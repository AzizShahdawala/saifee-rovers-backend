import express from "express";
import upload from "../middleware/upload.js";
import asyncHandler from "../utils/asyncHandler.js";
import { deleteMember, getMember, listMembers, registerMember, updateMember } from "../controllers/memberController.js";

const router = express.Router();
router.get("/", asyncHandler(listMembers));
router.get("/:id", asyncHandler(getMember));
router.post("/register", upload.array("images", 5), asyncHandler(registerMember));
router.put("/:id", asyncHandler(updateMember));
router.delete("/:id", asyncHandler(deleteMember));
export default router;
