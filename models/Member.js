import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  fileName: String,
  path: String,
}, { _id: false });

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  patrol: {
    type: String,
    required: true,
  },
  folder: String,
  images: [imageSchema],
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  faceEnrolled: { type: Boolean, default: false },
  descriptor: { type: [Number], select: false, default: undefined },
}, { timestamps: true });

memberSchema.index({ email: 1 }, { unique: true, sparse: true });
memberSchema.index({ phone: 1 }, { unique: true, sparse: true });

memberSchema.virtual("profileImage").get(function profileImage() {
  const image = this.images?.[0];
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return image ? `${baseUrl}/${String(image.path).replaceAll("\\\\", "/")}` : undefined;
});

memberSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Member", memberSchema);
