import Attendance from "../models/Attendance.js";
import Member from "../models/Member.js";
import Event from "../models/Event.js";
import httpError from "../utils/httpError.js";
import { cosineSimilarity, embeddingFromDataUrl } from "../services/faceRecognitionService.js";
import { refreshEventStatus, syncEventStatuses } from "../services/eventStatusService.js";

const populate = (query) => query.populate("member", "name email phone patrol status images").populate("event", "title date venue");

export async function listAttendance(req, res) {
  const filter = {};
  if (req.query.memberId) filter.member = req.query.memberId;
  if (req.query.eventId) filter.event = req.query.eventId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.from || req.query.to) {
    filter.timestamp = {};
    if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
    if (req.query.to) filter.timestamp.$lte = new Date(req.query.to);
  }
  const attendance = await populate(Attendance.find(filter).sort({ timestamp: -1 }));
  res.json({ success: true, attendance });
}

export async function recordManual(req, res) {
  const { memberId, eventId, status = "present" } = req.body;
  if (!memberId || !eventId) throw httpError(400, "Member and event are required");
  await syncEventStatuses();
  const [member, event] = await Promise.all([Member.findById(memberId), Event.findById(eventId)]);
  if (!member) throw httpError(404, "Member not found");
  if (!event) throw httpError(404, "Event not found");
  await refreshEventStatus(event);
  if (!["active", "ongoing"].includes(event.status)) {
    throw httpError(400, "Manual attendance can only be recorded while an event is active");
  }
  let attendance;
  try {
    attendance = await Attendance.create({ member: memberId, event: eventId, status, source: "manual" });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, "Attendance has already been recorded for this member and event");
    throw error;
  }
  await attendance.populate([{ path: "member", select: "name email phone patrol status images" }, { path: "event", select: "title date venue" }]);
  res.status(201).json({ success: true, attendance });
}

export async function recognizeAttendance(req, res) {
  await syncEventStatuses();
  if (!req.body.image) throw httpError(400, "A camera image is required");
  const event = req.body.eventId
    ? await Event.findById(req.body.eventId)
    : await Event.findOne({ status: { $in: ["active", "ongoing"] } }).sort({ date: -1, startTime: -1 });
  if (!event) throw httpError(400, "No active event is available for attendance scanning");
  await refreshEventStatus(event);
  if (!["active", "ongoing"].includes(event.status)) throw httpError(400, event.status === "completed" ? "This event has ended and no longer accepts scanner attendance" : "This event is not currently active");

  const face = await embeddingFromDataUrl(req.body.image);
  const members = await Member.find({ status: "active", faceEnrolled: true }).select("+descriptor");
  if (!members.length) throw httpError(404, "No face-enrolled members are available. Re-enroll a member first");

  let bestMember = null;
  let bestScore = -1;
  for (const member of members) {
    const score = cosineSimilarity(face.embedding, member.descriptor);
    if (score > bestScore) { bestMember = member; bestScore = score; }
  }
  const threshold = Number(process.env.FACE_MATCH_THRESHOLD || 0.45);
  if (!bestMember || bestScore < threshold) throw httpError(404, "Face not recognized. Try again with the same lighting used during enrollment");

  let attendance;
  try {
    attendance = await Attendance.create({ member: bestMember._id, event: event._id, status: "present", source: "recognition", confidence: bestScore });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, `Attendance is already recorded for ${bestMember.name} at ${event.title}`);
    throw error;
  }
  await attendance.populate([{ path: "member", select: "name email phone patrol status images" }, { path: "event", select: "title date venue" }]);
  res.status(201).json({ success: true, attendance });
}

export async function updateAttendance(req, res) {
  const attendance = await populate(Attendance.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true }));
  if (!attendance) throw httpError(404, "Attendance record not found");
  res.json({ success: true, attendance });
}

export async function deleteAttendance(req, res) {
  const attendance = await Attendance.findByIdAndDelete(req.params.id);
  if (!attendance) throw httpError(404, "Attendance record not found");
  res.json({ success: true, message: "Attendance record deleted" });
}
