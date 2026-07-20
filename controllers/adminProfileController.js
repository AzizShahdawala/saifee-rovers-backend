import fs from "fs/promises";
import AdminUser from "../models/AdminUser.js";
import httpError from "../utils/httpError.js";

export async function getAdminProfile(req, res) {
  const admin = await AdminUser.findById(req.user.sub);
  if (!admin || !admin.active) throw httpError(404, "Administrator profile not found");
  res.json({ success: true, admin });
}

export async function changeAdminPassword(req, res) {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (!currentPassword || newPassword.length < 8) throw httpError(400, "Current password and a new password of at least 8 characters are required");
  const admin = await AdminUser.findById(req.user.sub).select("+passwordHash +passwordSalt");
  if (!admin || !admin.active) throw httpError(404, "Administrator profile not found");
  if (!admin.verifyPassword(currentPassword)) throw httpError(400, "Current password is incorrect");
  if (admin.verifyPassword(newPassword)) throw httpError(400, "New password must be different from the current password");
  admin.setPassword(newPassword);
  await admin.save();
  res.json({ success: true, message: "Password changed successfully" });
}

export async function updateAdminProfilePhoto(req, res) {
  if (!req.file) throw httpError(400, "Choose a JPG or PNG image up to 5 MB");
  const admin = await AdminUser.findById(req.user.sub);
  if (!admin || !admin.active) {
    await fs.unlink(req.file.path).catch(() => {});
    throw httpError(404, "Administrator profile not found");
  }
  const previousPath = admin.profilePhoto?.path;
  admin.profilePhoto = { fileName: req.file.filename, path: req.file.path };
  await admin.save();
  if (previousPath && previousPath !== req.file.path) await fs.unlink(previousPath).catch(() => {});
  res.json({ success: true, message: "Profile picture updated", admin });
}
