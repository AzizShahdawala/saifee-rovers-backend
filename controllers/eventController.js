import Event from "../models/Event.js";
import Attendance from "../models/Attendance.js";
import EventMedia from "../models/EventMedia.js";
import { deleteStoredEventMedia } from "../services/eventMediaStorageService.js";
import Member from "../models/Member.js";
import fs from "fs/promises";
import path from "path";
import httpError from "../utils/httpError.js";
import { refreshEventStatus, syncEventStatuses } from "../services/eventStatusService.js";

const writable = ["title", "date", "startTime", "endTime", "venue", "agenda", "status"];
const body = (value) => Object.fromEntries(writable.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));

export async function createEvent(req, res) {
  if (!req.body.title?.trim() || !req.body.date) throw httpError(400, "Title and date are required");
  const event = await Event.create(body(req.body));
  await refreshEventStatus(event);
  res.status(201).json({ success: true, event });
}

export async function listEvents(req, res) {
  await syncEventStatuses();
  const memberCount = await Member.countDocuments();
  const events = await Event.aggregate([
    { $sort: { date: -1 } },
    { $lookup: { from: "attendances", localField: "_id", foreignField: "event", as: "attendanceRecords" } },
    { $addFields: { attendeeCount: { $size: { $filter: { input: "$attendanceRecords", as: "a", cond: { $in: ["$$a.status", ["present", "late"]] } } } } } },
    { $addFields: { attendancePercentage: memberCount ? { $round: [{ $multiply: [{ $divide: ["$attendeeCount", memberCount] }, 100] }, 0] } : 0 } },
    { $project: { attendanceRecords: 0 } },
  ]);
  res.json({ success: true, events });
}

export async function getEvent(req, res) {
  const event = await Event.findById(req.params.id);
  if (!event) throw httpError(404, "Event not found");
  await refreshEventStatus(event);
  res.json({ success: true, event });
}

export async function updateEvent(req, res) {
  const event = await Event.findById(req.params.id);
  if (!event) throw httpError(404, "Event not found");
  await refreshEventStatus(event);
  if (["completed", "cancelled"].includes(event.status)) throw httpError(409, `${event.status === "completed" ? "Completed" : "Cancelled"} events are read-only and cannot be changed`);
  event.set(body(req.body));
  await event.save();
  await refreshEventStatus(event);
  res.json({ success: true, event });
}

export async function deleteEvent(req, res) {
  const event = await Event.findByIdAndDelete(req.params.id);
  if (!event) throw httpError(404, "Event not found");
  await Attendance.deleteMany({ event: event._id });
  const media = await EventMedia.find({ event: event._id });
  await Promise.all(media.map(deleteStoredEventMedia));
  await EventMedia.deleteMany({ event: event._id });
  await fs.rm(path.join("uploads", "events", String(event._id)), { recursive: true, force: true });
  res.json({ success: true, message: "Event deleted" });
}
