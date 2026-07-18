import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  status: {
    type: String,
    enum: ["present", "absent", "late", "excused"],
    default: "present",
  },
  source: { type: String, enum: ["manual", "recognition"], default: "manual" },
  confidence: { type: Number, min: 0, max: 1 },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

attendanceSchema.index({ member: 1, event: 1 }, { unique: true });
attendanceSchema.index({ timestamp: -1 });

export default mongoose.model("Attendance", attendanceSchema);
