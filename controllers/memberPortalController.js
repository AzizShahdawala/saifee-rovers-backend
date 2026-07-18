import Member from "../models/Member.js";
import Event from "../models/Event.js";
import Attendance from "../models/Attendance.js";
import httpError from "../utils/httpError.js";
import fs from "fs/promises";
import { syncEventStatuses } from "../services/eventStatusService.js";

const attendanceQuery = (memberId) => Attendance.find({ member: memberId })
  .sort({ timestamp: -1 })
  .populate("event", "title date startTime endTime venue agenda status")
  .populate("member", "name patrol images");

export async function getMemberProfile(req, res) {
  const member = await Member.findById(req.user.sub);
  if (!member || member.status !== "active") throw httpError(404, "Member profile not found");
  res.json({ success: true, member });
}

export async function changeMemberPassword(req, res) {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (!currentPassword || newPassword.length < 8) throw httpError(400, "Current password and a new password of at least 8 characters are required");
  const member = await Member.findById(req.user.sub).select("+passwordHash +passwordSalt");
  if (!member || member.status !== "active") throw httpError(404, "Member profile not found");
  if (!member.verifyPassword(currentPassword)) throw httpError(400, "Current password is incorrect");
  if (member.verifyPassword(newPassword)) throw httpError(400, "New password must be different from the current password");
  member.setPassword(newPassword);
  await member.save();
  res.json({ success: true, message: "Password changed successfully" });
}

export async function updateMemberProfilePhoto(req, res) {
  if (!req.file) throw httpError(400, "Choose a JPG or PNG image up to 5 MB");
  const member = await Member.findById(req.user.sub);
  if (!member || member.status !== "active") {
    await fs.unlink(req.file.path).catch(() => {});
    throw httpError(404, "Member profile not found");
  }
  const previousPath = member.profilePhoto?.path;
  member.profilePhoto = { fileName: req.file.filename, path: req.file.path };
  await member.save();
  if (previousPath && previousPath !== req.file.path) await fs.unlink(previousPath).catch(() => {});
  res.json({ success: true, message: "Profile picture updated", member });
}

export async function getMemberAttendance(req, res) {
  const attendance = await attendanceQuery(req.user.sub);
  res.json({ success: true, attendance });
}

export async function getMemberEvents(req, res) {
  await syncEventStatuses();
  const [attendance, upcomingEvents] = await Promise.all([
    attendanceQuery(req.user.sub),
    Event.find({ status: { $in: ["upcoming", "active", "ongoing"] } }).sort({ date: 1 }).limit(20),
  ]);
  res.json({ success: true, attendedEvents: attendance, upcomingEvents });
}

export async function getMemberDashboard(req, res) {
  await syncEventStatuses();
  const member = await Member.findById(req.user.sub);
  if (!member || member.status !== "active") throw httpError(404, "Member profile not found");
  const attendance = await attendanceQuery(member._id);
  const presentStatuses = new Set(["present", "late"]);
  const attendedCount = attendance.filter((record) => presentStatuses.has(record.status)).length;
  const lateCount = attendance.filter((record) => record.status === "late").length;
  const upcomingEvents = await Event.find({ status: { $in: ["upcoming", "active", "ongoing"] } }).sort({ date: 1 }).limit(5);
  const monthlyMap = new Map();
  for (const record of attendance) {
    const key = new Date(record.timestamp).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + (presentStatuses.has(record.status) ? 1 : 0));
  }
  res.json({
    success: true,
    member,
    stats: {
      totalRecords: attendance.length,
      attendedEvents: attendedCount,
      lateArrivals: lateCount,
      attendanceRate: attendance.length ? Math.round((attendedCount / attendance.length) * 100) : 0,
    },
    recentAttendance: attendance.slice(0, 6),
    upcomingEvents,
    monthlyAttendance: [...monthlyMap].slice(0, 6).reverse().map(([label, value]) => ({ label, value })),
  });
}
