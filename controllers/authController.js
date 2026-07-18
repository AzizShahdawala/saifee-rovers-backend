import crypto from "crypto";
import AdminUser from "../models/AdminUser.js";
import Member from "../models/Member.js";
import { createToken } from "../utils/token.js";
import httpError from "../utils/httpError.js";
import { sendMemberOtp } from "../services/emailService.js";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const publicMember = (member) => ({
  id: member._id,
  name: member.name,
  email: member.email,
  phone: member.phone,
  patrol: member.patrol,
  role: "member",
  profileImage: member.profileImage,
});

export async function login(req, res) {
  const email = req.body.email?.trim().toLowerCase();
  const { password } = req.body;
  if (!email || !password) throw httpError(400, "Email and password are required");
  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) throw httpError(503, "JWT authentication is not configured on the server");

  const admin = await AdminUser.findOne({ email, active: true }).select("+passwordHash +passwordSalt");
  if (!admin || !admin.verifyPassword(password)) throw httpError(401, "Invalid email or password");

  admin.lastLoginAt = new Date();
  await admin.save();
  const user = { id: admin._id, name: admin.name, email: admin.email, role: admin.role };
  res.json({ success: true, token: createToken({ sub: String(admin._id), email: admin.email, role: admin.role }), user });
}

export async function requestMemberOtp(req, res) {
  const email = req.body.email?.trim().toLowerCase();
  const phone = normalizePhone(req.body.phone);
  if (!email || !phone) throw httpError(400, "Registered email and phone number are required");
  const member = await Member.findOne({ email, status: "active" }).select("+otpHash +otpSalt +otpExpiresAt +otpRequestedAt +otpAttempts");
  if (!member || normalizePhone(member.phone) !== phone) throw httpError(404, "No active member matches that email and phone number");
  if (member.otpRequestedAt && Date.now() - member.otpRequestedAt.getTime() < 60_000) {
    throw httpError(429, "Please wait one minute before requesting another code");
  }
  const otp = String(crypto.randomInt(100000, 1000000));
  member.otpSalt = crypto.randomBytes(16).toString("hex");
  member.otpHash = crypto.scryptSync(otp, member.otpSalt, 32).toString("hex");
  member.otpExpiresAt = new Date(Date.now() + 10 * 60_000);
  member.otpRequestedAt = new Date();
  member.otpAttempts = 0;
  await member.save();
  const delivered = await sendMemberOtp(member, otp);
  res.json({
    success: true,
    message: delivered ? `Verification code sent to ${email}` : "Development verification code generated",
    expiresInSeconds: 600,
    ...(process.env.NODE_ENV !== "production" && !delivered ? { developmentOtp: otp } : {}),
  });
}

export async function setMemberPassword(req, res) {
  const email = req.body.email?.trim().toLowerCase();
  const phone = normalizePhone(req.body.phone);
  const otp = String(req.body.otp || "").trim();
  const password = String(req.body.password || "");
  if (!email || !phone || !/^\d{6}$/.test(otp)) throw httpError(400, "Email, phone and a six-digit verification code are required");
  if (password.length < 8) throw httpError(400, "Password must be at least 8 characters");
  const member = await Member.findOne({ email, status: "active" }).select("+passwordHash +passwordSalt +otpHash +otpSalt +otpExpiresAt +otpAttempts");
  if (!member || normalizePhone(member.phone) !== phone) throw httpError(404, "Member not found");
  if (!member.otpHash || !member.otpSalt || !member.otpExpiresAt || member.otpExpiresAt < new Date()) throw httpError(400, "Verification code has expired. Request a new code");
  if ((member.otpAttempts || 0) >= 5) throw httpError(429, "Too many incorrect attempts. Request a new code");
  const candidate = crypto.scryptSync(otp, member.otpSalt, 32);
  const stored = Buffer.from(member.otpHash, "hex");
  if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) {
    member.otpAttempts = (member.otpAttempts || 0) + 1;
    await member.save();
    throw httpError(400, "Incorrect verification code");
  }
  member.setPassword(password);
  member.otpHash = undefined;
  member.otpSalt = undefined;
  member.otpExpiresAt = undefined;
  member.otpRequestedAt = undefined;
  member.otpAttempts = 0;
  await member.save();
  res.json({ success: true, message: "Password set successfully. You can now sign in" });
}

export async function memberLogin(req, res) {
  const email = req.body.email?.trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) throw httpError(400, "Email and password are required");
  const member = await Member.findOne({ email, status: "active" }).select("+passwordHash +passwordSalt");
  if (!member?.passwordHash) throw httpError(403, "Set your member password before signing in");
  if (!member.verifyPassword(password)) throw httpError(401, "Invalid email or password");
  member.lastLoginAt = new Date();
  await member.save();
  const user = publicMember(member);
  res.json({ success: true, token: createToken({ sub: String(member._id), email: member.email, role: "member" }, 24 * 60 * 60), user });
}
