import mongoose from "mongoose";

const celebrationEmailLogSchema = new mongoose.Schema({
  dateKey: { type: String, required: true },
  kind: { type: String, enum: ["birthday", "waras", "anniversary"], required: true },
  personKey: { type: String, required: true },
  recipient: { type: String, required: true },
  messageId: String,
}, { timestamps: true });

celebrationEmailLogSchema.index({ dateKey: 1, kind: 1, personKey: 1 }, { unique: true });
export default mongoose.model("CelebrationEmailLog", celebrationEmailLogSchema);
