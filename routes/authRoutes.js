import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import { login, memberLogin, requestMemberOtp, setMemberPassword } from "../controllers/authController.js";
const router = express.Router();
router.post("/login", asyncHandler(login));
router.post("/member/request-otp", asyncHandler(requestMemberOtp));
router.post("/member/set-password", asyncHandler(setMemberPassword));
router.post("/member/login", asyncHandler(memberLogin));
export default router;
