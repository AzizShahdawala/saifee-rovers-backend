import Member from "../models/Member.js";
import Event from "../models/Event.js";
import Attendance from "../models/Attendance.js";
import httpError from "../utils/httpError.js";

const attendanceQuery = (memberId) => Attendance.find({ member: memberId })
  .sort({ timestamp: -1 })
  .populate("event", "title date startTime endTime venue agenda status")
  .populate("member", "name patrol images");

export async function getMemberProfile(req, res) {
  const member = await Member.findById(req.user.sub);
  if (!member || member.status !== "active") throw httpError(404, "Member profile not found");
  res.json({ success: true, member });
}

export async function getMemberAttendance(req, res) {
  const attendance = await attendanceQuery(req.user.sub);
  res.json({ success: true, attendance });
}

export async function getMemberEvents(req, res) {
  const [attendance, upcomingEvents] = await Promise.all([
    attendanceQuery(req.user.sub),
    Event.find({ date: { $gte: new Date() }, status: { $in: ["upcoming", "active", "ongoing"] } }).sort({ date: 1 }).limit(20),
  ]);
  res.json({ success: true, attendedEvents: attendance, upcomingEvents });
}

export async function getMemberDashboard(req, res) {
  const member = await Member.findById(req.user.sub);
  if (!member || member.status !== "active") throw httpError(404, "Member profile not found");
  const attendance = await attendanceQuery(member._id);
  const presentStatuses = new Set(["present", "late"]);
  const attendedCount = attendance.filter((record) => presentStatuses.has(record.status)).length;
  const lateCount = attendance.filter((record) => record.status === "late").length;
  const upcomingEvents = await Event.find({ date: { $gte: new Date() }, status: { $in: ["upcoming", "active", "ongoing"] } }).sort({ date: 1 }).limit(5);
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
