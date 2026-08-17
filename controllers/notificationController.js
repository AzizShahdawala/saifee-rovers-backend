import Notification from "../models/Notification.js";
import httpError from "../utils/httpError.js";

const filterFor = (user) => user.role === "admin" ? { recipientRole: "admin" } : { recipientRole: "member", recipient: user.sub };
export async function listNotifications(req, res) {
  const filter = filterFor(req.user);
  const [notifications, unreadCount] = await Promise.all([Notification.find(filter).sort({ createdAt: -1 }).limit(100), Notification.countDocuments({ ...filter, readAt: null })]);
  res.json({ success: true, notifications, unreadCount });
}
export async function markNotificationRead(req, res) {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, ...filterFor(req.user) }, { $set: { readAt: new Date() } }, { new: true });
  if (!notification) throw httpError(404, "Notification not found");
  res.json({ success: true, notification });
}
export async function markAllNotificationsRead(req, res) {
  const result = await Notification.updateMany({ ...filterFor(req.user), readAt: null }, { $set: { readAt: new Date() } });
  res.json({ success: true, modified: result.modifiedCount });
}
