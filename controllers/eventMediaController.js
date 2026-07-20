import fs from "fs/promises";
import Event from "../models/Event.js";
import EventMedia from "../models/EventMedia.js";
import httpError from "../utils/httpError.js";
import { refreshEventStatus } from "../services/eventStatusService.js";

export async function listEventMedia(req, res) {
  const event = await Event.findById(req.params.eventId);
  if (!event) throw httpError(404, "Event not found");
  await refreshEventStatus(event);
  const media = await EventMedia.find({ event: event._id }).sort({ createdAt: -1 });
  res.json({ success: true, event: { _id: event._id, title: event.title, status: event.status }, media });
}

export async function uploadEventMedia(req, res) {
  const files = req.files || [];
  if (!files.length) throw httpError(400, "Choose at least one photo or video");
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
    throw httpError(404, "Event not found");
  }
  await refreshEventStatus(event);
  if (event.status !== "completed") {
    await Promise.all(files.map((file) => fs.unlink(file.path).catch(() => {})));
    throw httpError(409, "Photos and videos can only be uploaded after an event is completed");
  }
  const media = await EventMedia.insertMany(files.map((file) => ({
    event: event._id,
    mediaType: file.mimetype.startsWith("video/") ? "video" : "image",
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    path: file.path,
    size: file.size,
    uploadedBy: req.user.sub,
  })));
  res.status(201).json({ success: true, message: `${media.length} file${media.length === 1 ? "" : "s"} uploaded`, media });
}
