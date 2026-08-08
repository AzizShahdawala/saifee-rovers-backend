import mongoose from "mongoose";

const contactInquirySchema = new mongoose.Schema({
  referenceNumber: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 24 },
  email: { type: String, trim: true, lowercase: true, maxlength: 160, default: "" },
  eventTitle: { type: String, required: true, trim: true, maxlength: 140 },
  eventDate: Date,
  eventDescription: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ["new", "contacted", "closed"], default: "new", index: true },
  adminEmailStatus: { type: String, enum: ["pending", "sent", "partial", "failed"], default: "pending" },
  emailedAdmins: { type: [String], default: [] },
  emailError: { type: String, default: "", select: false },
  sourceIp: { type: String, default: "", select: false },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  handledAt: Date,
}, { timestamps: true });

contactInquirySchema.index({ createdAt: -1 });

export default mongoose.model("ContactInquiry", contactInquirySchema);
