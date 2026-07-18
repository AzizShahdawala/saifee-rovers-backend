import multer from "multer";

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = error.status || 500;
  let message = error.message || "Internal server error";
  if (error instanceof multer.MulterError) status = 400;
  if (error.name === "ValidationError") status = 400;
  if (error.name === "CastError") { status = 400; message = "Invalid resource id"; }
  if (error.code === 11000) { status = 409; message = "A record with those unique details already exists"; }

  if (process.env.NODE_ENV !== "test") console.error(error);
  res.status(status).json({ success: false, message });
}
