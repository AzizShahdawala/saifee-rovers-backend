import express from "express";
import requireAuth, { requireRole } from "../middleware/auth.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createReceipt, downloadReceipt, listReceipts, resendReceipt, voidReceipt } from "../controllers/receiptController.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", asyncHandler(listReceipts));
router.get("/:id/pdf", asyncHandler(downloadReceipt));
router.post("/", requireRole("admin"), asyncHandler(createReceipt));
router.post("/:id/resend", requireRole("admin"), asyncHandler(resendReceipt));
router.patch("/:id/void", requireRole("admin"), asyncHandler(voidReceipt));

export default router;
