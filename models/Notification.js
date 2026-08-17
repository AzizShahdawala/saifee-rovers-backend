import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipientRole: { type: String, enum: ["admin", "member"], required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null, index: true },
  type: { type: String, enum: ["birthday", "waras", "anniversary", "event", "attendance", "marketplace"], required: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  link: { type: String, default: "" },
  readAt: { type: Date, default: null },
  dedupeKey: { type: String, required: true, unique: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ recipientRole: 1, recipient: 1, createdAt: -1 });
export default mongoose.model("Notification", notificationSchema);
