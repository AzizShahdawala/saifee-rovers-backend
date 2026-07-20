import Member from "../models/Member.js";
import Event from "../models/Event.js";
import Attendance from "../models/Attendance.js";
import { syncEventStatuses } from "../services/eventStatusService.js";

export async function getDashboard(req, res) {
  await syncEventStatuses();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const [totalMembers, activeEvents, todayAttendance, totalAttendance, presentAttendance, recentAttendance, upcomingEvents, recentMembers, patrols] = await Promise.all([
    Member.countDocuments(),
    Event.countDocuments({ status: { $in: ["upcoming", "active", "ongoing"] }, date: { $gte: today } }),
    Attendance.countDocuments({ timestamp: { $gte: today, $lt: tomorrow }, status: { $in: ["present", "late"] } }),
    Attendance.countDocuments(),
    Attendance.countDocuments({ status: { $in: ["present", "late"] } }),
    Attendance.find().sort({ timestamp: -1 }).limit(6).populate("member", "name patrol images").populate("event", "title date venue"),
    Event.find({ date: { $gte: today }, status: { $ne: "cancelled" } }).sort({ date: 1 }).limit(5),
    Member.find().sort({ createdAt: -1 }).limit(6),
    Member.aggregate([{ $group: { _id: { $ifNull: ["$patrol", "Unassigned"] }, value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
  ]);
  res.json({
    success: true,
    totalMembers, activeEvents, todayAttendance,
    attendanceRate: totalAttendance ? Math.round((presentAttendance / totalAttendance) * 100) : 0,
    recentAttendance, upcomingEvents, recentMembers,
    patrolDistribution: patrols.map(({ _id, value }) => ({ label: _id, value })),
  });
}
