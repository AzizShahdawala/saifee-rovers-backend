import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema({
  receiptNumber: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ["INR"], default: "INR" },
  paymentMode: { type: String, enum: ["cash", "online_transfer"], required: true },
  paymentReference: { type: String, trim: true, maxlength: 100, default: "" },
  paidOn: { type: Date, required: true },
  notes: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, enum: ["issued", "void"], default: "issued", index: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  emailedAt: Date,
  emailStatus: { type: String, enum: ["pending", "sent", "failed", "not_available"], default: "pending" },
  emailError: { type: String, default: "", select: false },
  voidedAt: Date,
  voidReason: { type: String, trim: true, maxlength: 300, default: "" },
}, { timestamps: true });

receiptSchema.index({ member: 1, createdAt: -1 });

export default mongoose.model("Receipt", receiptSchema);
