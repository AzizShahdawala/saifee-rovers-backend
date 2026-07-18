import { verifyToken } from "../utils/token.js";

export default function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ success: false, message: "Authentication required" });
  req.user = user;
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ success: false, message: "You do not have access to this resource" });
    next();
  };
}
