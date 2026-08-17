import Event from "../models/Event.js";
import EventMedia from "../models/EventMedia.js";
import httpError from "../utils/httpError.js";
import { refreshEventStatus } from "../services/eventStatusService.js";
import { deleteStoredEventMedia, mediaLinks, storeEventMediaBuffer, streamStoredEventMedia, verifyMediaLink } from "../services/eventMediaStorageService.js";

const serializeMedia = (media) => ({ ...media.toJSON(), ...mediaLinks(media._id) });

export async function listGalleryMedia(req, res) {
  const requestedType = req.query.type || "all";
  if (!["all", "image", "video"].includes(requestedType)) {
    throw httpError(400, "Type must be all, image, or video");
  }

  const match = { available: { $ne: false }, ...(requestedType === "all" ? {} : { mediaType: requestedType }) };
  const media = await EventMedia.find(match)
    .populate("event", "title date venue status")
    .sort({ createdAt: -1 });

  const groupedEvents = new Map();
  for (const item of media) {
    if (!item.event) continue;
    const eventId = String(item.event._id);
    if (!groupedEvents.has(eventId)) {
      groupedEvents.set(eventId, { event: item.event, media: [] });
    }
    groupedEvents.get(eventId).media.push(serializeMedia(item));
  }

  const events = [...groupedEvents.values()].sort((left, right) => {
    const dateDifference = new Date(right.event.date) - new Date(left.event.date);
    return dateDifference || String(right.event._id).localeCompare(String(left.event._id));
  });

  const counts = await EventMedia.aggregate([
    { $match: { available: { $ne: false } } },
    { $group: { _id: "$mediaType", count: { $sum: 1 } } },
  ]);
  const countByType = Object.fromEntries(counts.map(({ _id, count }) => [_id, count]));

  res.json({
    success: true,
    events,
    summary: {
      total: (countByType.image || 0) + (countByType.video || 0),
      images: countByType.image || 0,
      videos: countByType.video || 0,
      events: events.length,
    },
  });
}

export async function listEventMedia(req, res) {
  const event = await Event.findById(req.params.eventId);
  if (!event) throw httpError(404, "Event not found");
  await refreshEventStatus(event);
  const media = await EventMedia.find({ event: event._id }).sort({ createdAt: -1 });
  res.json({ success: true, event: { _id: event._id, title: event.title, status: event.status }, media: media.filter((item) => item.available !== false).map(serializeMedia) });
}

export async function uploadEventMedia(req, res) {
  const files = req.files || [];
  if (!files.length) throw httpError(400, "Choose at least one photo or video");
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    throw httpError(404, "Event not found");
  }
  await refreshEventStatus(event);
  if (event.status !== "completed") {
    throw httpError(409, "Photos and videos can only be uploaded after an event is completed");
  }
  const stored = [];
  try {
    for (const file of files) {
      const gridFsId = await storeEventMediaBuffer(file, { eventId: String(event._id), uploadedBy: req.user.sub });
      stored.push({ file, gridFsId });
    }
    const media = await EventMedia.insertMany(stored.map(({ file, gridFsId }) => ({
      event: event._id,
      mediaType: file.mimetype.startsWith("video/") ? "video" : "image",
      fileName: String(gridFsId),
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storage: "gridfs",
      gridFsId,
      available: true,
      uploadedBy: req.user.sub,
    })));
    return res.status(201).json({ success: true, message: `${media.length} file${media.length === 1 ? "" : "s"} uploaded`, media: media.map(serializeMedia) });
  } catch (error) {
    await Promise.all(stored.map(({ gridFsId }) => deleteStoredEventMedia({ storage: "gridfs", gridFsId })));
    throw error;
  }
}

export async function streamEventMedia(req, res) {
  if (!verifyMediaLink(req.params.mediaId, req.query.expires, req.query.signature)) throw httpError(403, "Media link is invalid or expired");
  const media = await EventMedia.findById(req.params.mediaId);
  if (!media) throw httpError(404, "Media not found");
  return streamStoredEventMedia(req, res, media, req.path.endsWith("/download"));
}

export async function deleteAllEventMedia(req, res) {
  if (req.body.confirm !== "DELETE_ALL_EVENT_MEDIA") {
    throw httpError(400, "Set confirm to DELETE_ALL_EVENT_MEDIA to remove all uploaded event media");
  }

  const database = EventMedia.db.db;
  const [records, gridFsFiles, gridFsChunks] = await Promise.all([
    EventMedia.countDocuments({}),
    database.collection("eventMedia.files").countDocuments({}),
    database.collection("eventMedia.chunks").countDocuments({}),
  ]);

  const [recordResult, fileResult, chunkResult] = await Promise.all([
    EventMedia.deleteMany({}),
    database.collection("eventMedia.files").deleteMany({}),
    database.collection("eventMedia.chunks").deleteMany({}),
  ]);

  res.json({
    success: true,
    message: "All uploaded event media was deleted",
    found: { records, gridFsFiles, gridFsChunks },
    deleted: {
      records: recordResult.deletedCount,
      gridFsFiles: fileResult.deletedCount,
      gridFsChunks: chunkResult.deletedCount,
    },
  });
}
