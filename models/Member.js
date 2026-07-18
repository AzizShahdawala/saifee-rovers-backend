import crypto from "crypto";
import mongoose from "mongoose";

export const PATROLS = ["Fox", "Dove", "Bull", "Peacock", "Officers", "Mentor"];
export const INSTRUMENTS = ["Saxophone", "Clarinet", "Trumpet", "Trombone", "Euphonium", "Side Drum", "Base Drum", "Rhythm", "Band Inspector"];

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
    enum: PATROLS,
  },
  isPatrolLeader: { type: Boolean, default: false },
  patrolLeaderKey: { type: String, select: false, unique: true, sparse: true },
  instrument: { type: String, enum: ["", ...INSTRUMENTS], default: "" },
  bandInspectorKey: { type: String, select: false, unique: true, sparse: true },
  folder: String,
  images: [imageSchema],
  profilePhoto: imageSchema,
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  faceEnrolled: { type: Boolean, default: false },
  descriptor: { type: [Number], select: false, default: undefined },
  passwordHash: { type: String, select: false },
  passwordSalt: { type: String, select: false },
  passwordSetAt: Date,
  otpHash: { type: String, select: false },
  otpSalt: { type: String, select: false },
  otpExpiresAt: { type: Date, select: false },
  otpRequestedAt: { type: Date, select: false },
  otpAttempts: { type: Number, select: false, default: 0 },
  lastLoginAt: Date,
}, { timestamps: true });

memberSchema.index({ email: 1 }, { unique: true, sparse: true });
memberSchema.index({ phone: 1 }, { unique: true, sparse: true });
memberSchema.pre("validate", function assignUniqueRoleKeys() {
  this.patrolLeaderKey = this.isPatrolLeader ? this.patrol : undefined;
  this.bandInspectorKey = this.instrument === "Band Inspector" ? "Band Inspector" : undefined;
});

memberSchema.virtual("profileImage").get(function profileImage() {
  const image = this.profilePhoto?.path ? this.profilePhoto : this.images?.[0];
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return image ? `${baseUrl}/${String(image.path).replaceAll("\\\\", "/")}` : undefined;
});

memberSchema.set("toJSON", { virtuals: true });

memberSchema.methods.setPassword = function setPassword(password) {
  this.passwordSalt = crypto.randomBytes(16).toString("hex");
  this.passwordHash = crypto.scryptSync(password, this.passwordSalt, 64).toString("hex");
  this.passwordSetAt = new Date();
};

memberSchema.methods.verifyPassword = function verifyPassword(password) {
  if (!this.passwordHash || !this.passwordSalt) return false;
  const candidate = crypto.scryptSync(password, this.passwordSalt, 64);
  const stored = Buffer.from(this.passwordHash, "hex");
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
};

export default mongoose.model("Member", memberSchema);
