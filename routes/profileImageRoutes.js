import express from "express";
import asyncHandler from "../utils/asyncHandler.js";
import { streamProfileImage } from "../services/profileImageStorageService.js";

const router = express.Router();
router.get("/:id", asyncHandler(streamProfileImage));
export default router;
