import Event from "../models/Event.js";

const offsetMinutes = () => Number(process.env.EVENT_TIMEZONE_OFFSET_MINUTES || 330);
const dateKey = (date) => new Date(date).toISOString().slice(0, 10);
const offsetText = () => {
  const minutes = offsetMinutes();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
};
const instant = (date, time, fallback) => new Date(`${dateKey(date)}T${time || fallback}:00${offsetText()}`);

export function calculateEventStatus(event, now = new Date()) {
  if (event.status === "cancelled" || event.status === "completed") return event.status;
  const start = instant(event.date, event.startTime, "00:00");
  const end = instant(event.date, event.endTime, "23:59");
  if (now >= end) return "completed";
  if (now < start) return "upcoming";
  return "active";
}

export async function syncEventStatuses(now = new Date()) {
  const events = await Event.find({ status: { $nin: ["cancelled", "completed"] } }).select("date startTime endTime status");
  const updates = events.map((event) => ({ event, status: calculateEventStatus(event, now) })).filter(({ event, status }) => event.status !== status);
  if (updates.length) await Event.bulkWrite(updates.map(({ event, status }) => ({ updateOne: { filter: { _id: event._id }, update: { $set: { status } } } })));
  return updates.length;
}

export async function refreshEventStatus(event, now = new Date()) {
  const status = calculateEventStatus(event, now);
  if (event.status !== status) { event.status = status; await event.save(); }
  return event;
}
