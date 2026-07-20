import path from "path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import memberRoutes from "./routes/memberRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminProfileRoutes from "./routes/adminProfileRoutes.js";
import memberPortalRoutes from "./routes/memberPortalRoutes.js";
import asyncHandler from "./utils/asyncHandler.js";
import { getDashboard } from "./controllers/dashboardController.js";
import { recognitionServiceHealth } from "./services/faceRecognitionService.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

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
app.get("/api/health", (req, res) => res.json({ success: true, status: "ok" }));
app.get("/api/recognition/health", asyncHandler(async (req, res) => res.json({ success: true, service: await recognitionServiceHealth() })));
app.use("/api/auth", authRoutes);
app.use("/api/admin-profile", adminProfileRoutes);
app.use("/api/member-portal", memberPortalRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/attendance", attendanceRoutes);
app.get("/api/dashboard", asyncHandler(getDashboard));
app.use(notFound);
app.use(errorHandler);

export default app;
