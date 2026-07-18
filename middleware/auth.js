import { verifyToken } from "../utils/token.js";

export default function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ success: false, message: "Authentication required" });
  req.user = user;
  next();
}
