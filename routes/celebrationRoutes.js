import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { sendTodaysBirthdayWishes } from "../services/birthdayEmailService.js";

const router = express.Router();
router.post("/birthday-wishes", asyncHandler(async (req, res) => {
  const configured = process.env.CELEBRATION_JOB_SECRET || "";
  if (!configured || req.headers["x-job-secret"] !== configured) throw httpError(401, "Invalid job credentials");
  res.json({ success: true, ...(await sendTodaysBirthdayWishes()) });
}));
export default router;
