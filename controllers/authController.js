import AdminUser from "../models/AdminUser.js";
import { createToken } from "../utils/token.js";
import httpError from "../utils/httpError.js";

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
