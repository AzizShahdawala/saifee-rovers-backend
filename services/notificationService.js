import Notification from "../models/Notification.js";
import Member from "../models/Member.js";
import { sendAttendanceConfirmation, sendEventScheduledEmail } from "./emailService.js";

const realEmail = (email) => email && !email.endsWith("@saifeerovers.local");
export async function createNotification(data) {
  return Notification.findOneAndUpdate({ dedupeKey: data.dedupeKey }, { $setOnInsert: data }, { upsert: true, new: true });
}
export const createAdminNotification = (data) => createNotification({ ...data, recipientRole: "admin", recipient: null });
export const createMemberNotification = (memberId, data) => createNotification({ ...data, recipientRole: "member", recipient: memberId });

export async function notifyEventScheduled(event) {
  const members = await Member.find({ status: "active" }).select("name email");
  const dateLabel = new Date(event.date).toLocaleDateString("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" });
  await createAdminNotification({ type: "event", title: "Event scheduled", message: `${event.title} is scheduled for ${dateLabel} at ${event.venue}.`, link: "/events", dedupeKey: `event:${event._id}:admin` });
  const results = await Promise.allSettled(members.map(async (member) => {
    await createMemberNotification(member._id, { type: "event", title: "New event scheduled", message: `${event.title} is scheduled for ${dateLabel} at ${event.venue}.`, link: "/member/events", dedupeKey: `event:${event._id}:member:${member._id}`, metadata: { eventId: event._id } });
    if (realEmail(member.email)) await sendEventScheduledEmail({ email: member.email, recipientName: member.name, event });
  }));
  return { members: members.length, emailsFailed: results.filter((item) => item.status === "rejected").length };
}

export async function notifyAttendanceRecorded(attendance) {
  const member = attendance.member;
  const event = attendance.event;
  const time = new Date(attendance.timestamp).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" });
  const key = `attendance:${attendance._id}`;
  await Promise.all([
    createMemberNotification(member._id, { type: "attendance", title: "Attendance recorded", message: `You logged in for ${event.title} at ${time}.`, link: "/member/attendance", dedupeKey: `${key}:member`, metadata: { attendanceId: attendance._id, eventId: event._id } }),
    createAdminNotification({ type: "attendance", title: "Attendance recorded", message: `${member.name} logged in for ${event.title} at ${time}.`, link: "/attendance", dedupeKey: `${key}:admin`, metadata: { attendanceId: attendance._id, memberId: member._id, eventId: event._id } }),
  ]);
  if (realEmail(member.email)) await sendAttendanceConfirmation({ email: member.email, recipientName: member.name, event, timestamp: attendance.timestamp, status: attendance.status });
}
