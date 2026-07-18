import Member from "../models/Member.js";
import Event from "../models/Event.js";
import Attendance from "../models/Attendance.js";
import { syncEventStatuses } from "../services/eventStatusService.js";

export async function getDashboard(req, res) {
  await syncEventStatuses();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [totalMembers, activeEvents, todayAttendance, totalAttendance, presentAttendance, recentAttendance, upcomingEvents, recentMembers, trend, patrols, enrolled] = await Promise.all([
    Member.countDocuments(),
    Event.countDocuments({ status: { $in: ["upcoming", "active", "ongoing"] }, date: { $gte: today } }),
    Attendance.countDocuments({ timestamp: { $gte: today, $lt: tomorrow }, status: { $in: ["present", "late"] } }),
    Attendance.countDocuments(),
    Attendance.countDocuments({ status: { $in: ["present", "late"] } }),
    Attendance.find().sort({ timestamp: -1 }).limit(6).populate("member", "name patrol images").populate("event", "title date venue"),
    Event.find({ date: { $gte: today }, status: { $ne: "cancelled" } }).sort({ date: 1 }).limit(5),
    Member.find().sort({ createdAt: -1 }).limit(6),
    Attendance.aggregate([{ $match: { timestamp: { $gte: sevenDaysAgo }, status: { $in: ["present", "late"] } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, value: { $sum: 1 } } }]),
    Member.aggregate([{ $group: { _id: { $ifNull: ["$patrol", "Unassigned"] }, value: { $sum: 1 } } }, { $sort: { value: -1 } }]),
    Member.countDocuments({ faceEnrolled: true }),
  ]);
  const trendMap = new Map(trend.map((item) => [item._id, item.value]));
  const attendanceTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sevenDaysAgo); date.setDate(date.getDate() + index);
    return { label: date.toLocaleDateString("en-IN", { weekday: "short" }), value: trendMap.get(date.toISOString().slice(0, 10)) || 0 };
  });
  res.json({
    success: true,
    totalMembers, activeEvents, todayAttendance,
    attendanceRate: totalAttendance ? Math.round((presentAttendance / totalAttendance) * 100) : 0,
    recentAttendance, upcomingEvents, recentMembers, attendanceTrend,
    patrolDistribution: patrols.map(({ _id, value }) => ({ label: _id, value })),
    recognitionAccuracy: totalMembers ? Math.round((enrolled / totalMembers) * 100) : 0,
  });
}
