import crypto from "crypto";
import mongoose from "mongoose";

const adminUserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  passwordSalt: { type: String, required: true, select: false },
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

export default mongoose.model("AdminUser", adminUserSchema);
