import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import requireAuth, { requireRole } from "../middleware/auth.js";
import { createContactInquiry, listContactInquiries, resendContactInquiry, updateContactInquiry } from "../controllers/contactInquiryController.js";

const router = express.Router();
router.post("/", asyncHandler(createContactInquiry));
router.get("/", requireAuth, requireRole("admin"), asyncHandler(listContactInquiries));
router.patch("/:id", requireAuth, requireRole("admin"), asyncHandler(updateContactInquiry));
router.post("/:id/resend", requireAuth, requireRole("admin"), asyncHandler(resendContactInquiry));

export default router;
