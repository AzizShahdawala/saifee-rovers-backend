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

const attendedStatuses = new Set(["present", "late"]);

async function getMemberEventHistory(memberId) {
  await syncEventStatuses();
  const [events, attendance] = await Promise.all([
    Event.find({ status: "completed" }).sort({ date: -1 }).lean(),
    attendanceQuery(memberId),
  ]);
  const attendanceByEvent = new Map(
    attendance.filter((record) => record.event?._id).map((record) => [String(record.event._id), record])
  );
  const history = events.map((event) => {
    const record = attendanceByEvent.get(String(event._id));
    const status = record?.status || "absent";
    return {
      _id: event._id,
      event,
      date: event.date,
      attendanceId: record?._id || null,
      status,
      attended: attendedStatuses.has(status),
      timestamp: record?.timestamp || null,
      source: record?.source || null,
      confidence: record?.confidence ?? null,
    };
  });
  const attendedEvents = history.filter((item) => item.attended).length;
  const excusedEvents = history.filter((item) => item.status === "excused").length;
  const totalEvents = history.length;
  return {
    attendance,
    history,
    summary: {
      totalEvents,
      attendedEvents,
      missedEvents: Math.max(totalEvents - attendedEvents - excusedEvents, 0),
      excusedEvents,
      attendanceRate: totalEvents ? Math.round((attendedEvents / totalEvents) * 100) : 0,
    },
  };
}

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
  const { history, summary } = await getMemberEventHistory(req.user.sub);
  res.json({ success: true, attendance: history, summary });
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
  const member = await Member.findById(req.user.sub);
  if (!member || member.status !== "active") throw httpError(404, "Member profile not found");
  const { attendance, summary } = await getMemberEventHistory(member._id);
  const lateCount = attendance.filter((record) => record.status === "late").length;
  const upcomingEvents = await Event.find({ status: { $in: ["upcoming", "active", "ongoing"] } }).sort({ date: 1 }).limit(5);
  const monthlyMap = new Map();
  for (const record of attendance) {
    const key = new Date(record.timestamp).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + (attendedStatuses.has(record.status) ? 1 : 0));
  }
  res.json({
    success: true,
    member,
    stats: {
      ...summary,
      totalRecords: attendance.length,
      lateArrivals: lateCount,
    },
    recentAttendance: attendance.slice(0, 6),
    upcomingEvents,
    monthlyAttendance: [...monthlyMap].slice(0, 6).reverse().map(([label, value]) => ({ label, value })),
  });
}
