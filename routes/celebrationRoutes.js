import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import httpError from "../utils/httpError.js";
import { sendTodaysCelebrations } from "../services/birthdayEmailService.js";

const router = express.Router();
const run = asyncHandler(async (req, res) => {
  const configured = [process.env.CRON_SECRET, process.env.CELEBRATION_JOB_SECRET].filter(Boolean);
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!configured.length || !configured.some((secret) => req.headers["x-job-secret"] === secret || bearer === secret)) {
    throw httpError(401, "Invalid job credentials");
  }
  res.json({ success: true, ...(await sendTodaysCelebrations()) });
});
router.all("/birthday-wishes", run);
router.all("/daily", run);
export default router;
