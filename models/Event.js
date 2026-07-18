import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  startTime: { type: String, default: "" },
  endTime: { type: String, default: "" },
  venue: { type: String, trim: true, default: "" },
  agenda: { type: String, trim: true, default: "" },
  capacity: { type: Number, min: 0, default: 0 },
  status: {
    type: String,
    enum: ["upcoming", "active", "ongoing", "completed", "cancelled"],
    default: "upcoming",
  },
}, { timestamps: true });

eventSchema.index({ date: 1 });

export default mongoose.model("Event", eventSchema);
