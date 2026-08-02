import crypto from "crypto";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import httpError from "../utils/httpError.js";

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "eventMedia" });
const mediaSecret = () => process.env.JWT_SECRET || "";
const signatureFor = (mediaId, expires) => crypto.createHmac("sha256", mediaSecret()).update(`${mediaId}.${expires}`).digest("base64url");

export function mediaLinks(mediaId) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60;
  const signature = signatureFor(String(mediaId), expires);
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const url = `${baseUrl}/api/event-media/file/${mediaId}?expires=${expires}&signature=${signature}`;
  return { url, downloadUrl: `${baseUrl}/api/event-media/file/${mediaId}/download?expires=${expires}&signature=${signature}` };
}

export function verifyMediaLink(mediaId, expires, signature) {
  if (!mediaSecret() || !signature || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signatureFor(String(mediaId), expires));
  const actual = Buffer.from(String(signature));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function storeEventMediaBuffer(file, metadata = {}) {
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(file.originalname, { contentType: file.mimetype, metadata });
    stream.on("error", reject);
    stream.on("finish", () => resolve(stream.id));
    stream.end(file.buffer);
  });
}

export function storeEventMediaFile(filePath, { fileName, mimeType, metadata = {} }) {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(fileName, { contentType: mimeType, metadata });
    const source = fs.createReadStream(filePath);
    source.on("error", reject);
    upload.on("error", reject);
    upload.on("finish", () => resolve(upload.id));
    source.pipe(upload);
  });
}

export async function deleteStoredEventMedia(media) {
  if (media.storage === "gridfs" && media.gridFsId) {
    await bucket().delete(media.gridFsId).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

const parseRange = (header, size) => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || ""));
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start <= end && start < size ? { start, end } : null;
};

export async function streamStoredEventMedia(req, res, media, download = false) {
  if (!media.available) throw httpError(404, "Media file is unavailable");
  res.setHeader("Content-Type", media.mimeType);
  res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(media.originalName)}`);
  res.setHeader("Accept-Ranges", "bytes");
  if (media.storage === "gridfs" && media.gridFsId) {
    const range = parseRange(req.headers.range, media.size);
    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${media.size}`);
      res.setHeader("Content-Length", range.end - range.start + 1);
      return bucket().openDownloadStream(media.gridFsId, { start: range.start, end: range.end + 1 }).pipe(res);
    }
    res.setHeader("Content-Length", media.size);
    return bucket().openDownloadStream(media.gridFsId).pipe(res);
  }
  const localPath = path.resolve(media.path || "");
  if (!media.path || !fs.existsSync(localPath)) throw httpError(404, "Media file is unavailable");
  return res.sendFile(localPath);
}
