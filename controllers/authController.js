import crypto from "crypto";
import AdminUser from "../models/AdminUser.js";
import Member from "../models/Member.js";
import { createToken } from "../utils/token.js";
import httpError from "../utils/httpError.js";
import { sendPasswordOtp } from "../services/emailService.js";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const otpFields = "+passwordHash +passwordSalt +otpHash +otpSalt +otpExpiresAt +otpRequestedAt +otpAttempts";
const genericResetMessage = "If an active account matches that email, a verification code has been sent";

function createOtp(account) {
  const otp = String(crypto.randomInt(100000, 1000000));
  account.otpSalt = crypto.randomBytes(16).toString("hex");
  account.otpHash = crypto.scryptSync(otp, account.otpSalt, 32).toString("hex");
  account.otpExpiresAt = new Date(Date.now() + 10 * 60_000);
  account.otpRequestedAt = new Date();
  account.otpAttempts = 0;
  return otp;
}

function verifyOtp(account, otp) {
  if (!account.otpHash || !account.otpSalt || !account.otpExpiresAt || account.otpExpiresAt < new Date()) throw httpError(400, "Verification code has expired. Request a new code");
  if ((account.otpAttempts || 0) >= 5) throw httpError(429, "Too many incorrect attempts. Request a new code");
  const candidate = crypto.scryptSync(otp, account.otpSalt, 32);
  const stored = Buffer.from(account.otpHash, "hex");
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

function clearOtp(account) {
  account.otpHash = undefined;
  account.otpSalt = undefined;
  account.otpExpiresAt = undefined;
  account.otpRequestedAt = undefined;
  account.otpAttempts = 0;
}
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
  const member = await Member.findOne({ email, status: "active" }).select(otpFields);
  if (!member || normalizePhone(member.phone) !== phone) throw httpError(404, "No active member matches that email and phone number");
  if (member.otpRequestedAt && Date.now() - member.otpRequestedAt.getTime() < 60_000) {
    throw httpError(429, "Please wait one minute before requesting another code");
  }
  if (member.passwordHash) throw httpError(409, "Member access is already activated. Use forgot password to reset it");
  const otp = createOtp(member);
  await member.save();
  await sendPasswordOtp({ email: member.email, name: member.name, otp, purpose: "activation" });
  res.json({
    success: true,
    message: `Verification code sent to ${email}`,
    expiresInSeconds: 600,
  });
}

export async function setMemberPassword(req, res) {
  const email = req.body.email?.trim().toLowerCase();
  const phone = normalizePhone(req.body.phone);
  const otp = String(req.body.otp || "").trim();
  const password = String(req.body.password || "");
  if (!email || !phone || !/^\d{6}$/.test(otp)) throw httpError(400, "Email, phone and a six-digit verification code are required");
  if (password.length < 8) throw httpError(400, "Password must be at least 8 characters");
  const member = await Member.findOne({ email, status: "active" }).select(otpFields);
  if (!member || normalizePhone(member.phone) !== phone) throw httpError(404, "Member not found");
  if (member.passwordHash) throw httpError(409, "Member access is already activated. Use forgot password to reset it");
  if (!verifyOtp(member, otp)) {
    member.otpAttempts = (member.otpAttempts || 0) + 1;
    await member.save();
    throw httpError(400, "Incorrect verification code");
  }
  member.setPassword(password);
  clearOtp(member);
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

export async function requestPasswordReset(req, res) {
  const email = req.body.email?.trim().toLowerCase();
  const role = req.body.role === "member" ? "member" : req.body.role === "admin" ? "admin" : null;
  if (!email || !role) throw httpError(400, "Email and account type are required");
  const account = role === "member"
    ? await Member.findOne({ email, status: "active" }).select(otpFields)
    : await AdminUser.findOne({ email, active: true }).select(otpFields);
  if (!account) return res.json({ success: true, message: genericResetMessage, expiresInSeconds: 600 });
  if (account.otpRequestedAt && Date.now() - account.otpRequestedAt.getTime() < 60_000) throw httpError(429, "Please wait one minute before requesting another code");
  const otp = createOtp(account);
  await account.save();
  await sendPasswordOtp({ email: account.email, name: account.name, otp, purpose: "reset" });
  res.json({ success: true, message: genericResetMessage, expiresInSeconds: 600 });
}

export async function resetPassword(req, res) {
  const email = req.body.email?.trim().toLowerCase();
  const role = req.body.role === "member" ? "member" : req.body.role === "admin" ? "admin" : null;
  const otp = String(req.body.otp || "").trim();
  const password = String(req.body.password || "");
  if (!email || !role || !/^\d{6}$/.test(otp)) throw httpError(400, "Email, account type and a six-digit verification code are required");
  if (password.length < 8) throw httpError(400, "Password must be at least 8 characters");
  const account = role === "member"
    ? await Member.findOne({ email, status: "active" }).select(otpFields)
    : await AdminUser.findOne({ email, active: true }).select(otpFields);
  if (!account) throw httpError(400, "Invalid or expired verification code");
  if (!verifyOtp(account, otp)) {
    account.otpAttempts = (account.otpAttempts || 0) + 1;
    await account.save();
    throw httpError(400, "Incorrect verification code");
  }
  account.setPassword(password);
  clearOtp(account);
  await account.save();
  res.json({ success: true, message: "Password reset successfully. You can now sign in" });
}
