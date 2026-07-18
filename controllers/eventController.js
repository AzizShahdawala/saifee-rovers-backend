import Event from "../models/Event.js";
import Attendance from "../models/Attendance.js";
import httpError from "../utils/httpError.js";

const writable = ["title", "date", "startTime", "endTime", "venue", "agenda", "capacity", "status"];
const body = (value) => Object.fromEntries(writable.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));

export async function createEvent(req, res) {
  if (!req.body.title?.trim() || !req.body.date) throw httpError(400, "Title and date are required");
  const event = await Event.create(body(req.body));
  res.status(201).json({ success: true, event });
}

export async function listEvents(req, res) {
  const events = await Event.aggregate([
    { $sort: { date: -1 } },
    { $lookup: { from: "attendances", localField: "_id", foreignField: "event", as: "attendanceRecords" } },
    { $addFields: { attendeeCount: { $size: { $filter: { input: "$attendanceRecords", as: "a", cond: { $in: ["$$a.status", ["present", "late"]] } } } } } },
    { $addFields: { attendancePercentage: { $cond: [{ $gt: ["$capacity", 0] }, { $round: [{ $multiply: [{ $divide: ["$attendeeCount", "$capacity"] }, 100] }, 0] }, 0] } } },
    { $project: { attendanceRecords: 0 } },
  ]);
  res.json({ success: true, events });
}

export async function getEvent(req, res) {
  const event = await Event.findById(req.params.id);
  if (!event) throw httpError(404, "Event not found");
  res.json({ success: true, event });
}

export async function updateEvent(req, res) {
  const event = await Event.findByIdAndUpdate(req.params.id, body(req.body), { new: true, runValidators: true });
  if (!event) throw httpError(404, "Event not found");
  res.json({ success: true, event });
}

export async function deleteEvent(req, res) {
  const event = await Event.findByIdAndDelete(req.params.id);
  if (!event) throw httpError(404, "Event not found");
  await Attendance.deleteMany({ event: event._id });
  res.json({ success: true, message: "Event deleted" });
}
