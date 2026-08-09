import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { sendTodaysBirthdayWishes } from "../services/birthdayEmailService.js";

const router = express.Router();
router.all("/birthday-wishes", asyncHandler(async (req, res) => {
  const configured = process.env.CELEBRATION_JOB_SECRET || "";
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!configured || (req.headers["x-job-secret"] !== configured && bearer !== configured)) throw httpError(401, "Invalid job credentials");
  res.json({ success: true, ...(await sendTodaysBirthdayWishes()) });
}));
export default router;
