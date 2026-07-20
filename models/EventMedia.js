import mongoose from "mongoose";

const eventMediaSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
  mediaType: { type: String, enum: ["image", "video"], required: true },
  fileName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  path: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
}, { timestamps: true });

eventMediaSchema.virtual("url").get(function url() {
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${baseUrl}/${String(this.path).replaceAll("\\", "/")}`;
});

eventMediaSchema.set("toJSON", { virtuals: true });
export default mongoose.model("EventMedia", eventMediaSchema);
