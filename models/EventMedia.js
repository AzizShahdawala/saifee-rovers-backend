import mongoose from "mongoose";

const eventMediaSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
  mediaType: { type: String, enum: ["image", "video"], required: true },
  fileName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  path: { type: String },
  storage: { type: String, enum: ["local", "gridfs"], default: "local", index: true },
  gridFsId: { type: mongoose.Schema.Types.ObjectId },
  available: { type: Boolean, default: true, index: true },
  size: { type: Number, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
}, { timestamps: true });

eventMediaSchema.set("toJSON", { virtuals: true });
export default mongoose.model("EventMedia", eventMediaSchema);
