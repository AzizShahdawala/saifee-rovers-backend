import path from "path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import memberRoutes from "./routes/memberRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminProfileRoutes from "./routes/adminProfileRoutes.js";
import eventMediaRoutes from "./routes/eventMediaRoutes.js";
import memberPortalRoutes from "./routes/memberPortalRoutes.js";
import patrolScoreRoutes from "./routes/patrolScoreRoutes.js";
import birthdayRoutes from "./routes/birthdayRoutes.js";
import anniversaryRoutes from "./routes/anniversaryRoutes.js";
import warasRoutes from "./routes/warasRoutes.js";
import celebrationRoutes from "./routes/celebrationRoutes.js";
import receiptRoutes from "./routes/receiptRoutes.js";
import contactInquiryRoutes from "./routes/contactInquiryRoutes.js";
import profileImageRoutes from "./routes/profileImageRoutes.js";
import recognitionRoutes from "./routes/recognitionRoutes.js";
import connectDB from "./config/db.js";
import asyncHandler from "./utils/asyncHandler.js";
import { getDashboard } from "./controllers/dashboardController.js";
import { recognitionServiceHealth } from "./services/faceRecognitionService.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import Member from "./models/Member.js";

const app = express();
const origins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((item) => item.trim());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.use("/uploads", express.static(path.resolve("uploads")));
app.get("/", (req, res) => res.json({
  success: true,
  message: "Saifee Rovers backend is running",
  api: "/api",
  health: "/api/health",
}));
app.get("/api/health", (req, res) => res.json({ success: true, status: "ok", memberSchema: "hijri-patrol-history-v1", joinedYearRegistered: Boolean(Member.schema.path("joinedYear")), hijriDateOfBirthRegistered: Boolean(Member.schema.path("hijriDateOfBirth")), patrolHistoryRegistered: Boolean(Member.schema.path("patrolHistory")) }));
app.use("/api", asyncHandler(async (req, res, next) => {
  await connectDB();
  next();
}));
app.get("/api/recognition/health", asyncHandler(async (req, res) => res.json({ success: true, service: await recognitionServiceHealth() })));
app.use("/api/recognition", recognitionRoutes);
app.use("/api/profile-images", profileImageRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin-profile", adminProfileRoutes);
app.use("/api/event-media", eventMediaRoutes);
app.use("/api/member-portal", memberPortalRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/patrol-scores", patrolScoreRoutes);
app.use("/api/birthdays", birthdayRoutes);
app.use("/api/anniversaries", anniversaryRoutes);
app.use("/api/waras", warasRoutes);
app.use("/api/celebrations", celebrationRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/contact-inquiries", contactInquiryRoutes);
app.get("/api/dashboard", asyncHandler(getDashboard));
app.use(notFound);
app.use(errorHandler);

export default app;
