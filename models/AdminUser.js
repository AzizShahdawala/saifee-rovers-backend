import crypto from "crypto";
import mongoose from "mongoose";

const adminUserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  passwordSalt: { type: String, required: true, select: false },
  passwordSetAt: Date,
  otpHash: { type: String, select: false },
  otpSalt: { type: String, select: false },
  otpExpiresAt: { type: Date, select: false },
  otpRequestedAt: { type: Date, select: false },
  otpAttempts: { type: Number, select: false, default: 0 },
  role: { type: String, enum: ["admin"], default: "admin" },
  active: { type: Boolean, default: true },
  lastLoginAt: Date,
}, { timestamps: true });

adminUserSchema.statics.hashPassword = function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { passwordHash, passwordSalt: salt };
};

adminUserSchema.methods.verifyPassword = function verifyPassword(password) {
  const candidate = crypto.scryptSync(password, this.passwordSalt, 64);
  const stored = Buffer.from(this.passwordHash, "hex");
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
};

adminUserSchema.methods.setPassword = function setPassword(password) {
  const credentials = this.constructor.hashPassword(password);
  this.passwordHash = credentials.passwordHash;
  this.passwordSalt = credentials.passwordSalt;
  this.passwordSetAt = new Date();
};

export default mongoose.model("AdminUser", adminUserSchema);
