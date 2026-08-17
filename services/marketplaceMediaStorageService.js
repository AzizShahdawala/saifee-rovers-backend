import crypto from "crypto";
import mongoose from "mongoose";
import httpError from "../utils/httpError.js";

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "marketplaceMedia" });
const signatureFor = (mediaId, expires) => crypto.createHmac("sha256", process.env.JWT_SECRET || "").update(`${mediaId}.${expires}`).digest("base64url");

export function marketplaceMediaLink(listingId, mediaId) {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const signature = signatureFor(String(mediaId), expires);
  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${baseUrl}/api/marketplace/${listingId}/media/${mediaId}?expires=${expires}&signature=${signature}`;
}

export function verifyMarketplaceMediaLink(mediaId, expires, signature) {
  if (!process.env.JWT_SECRET || !signature || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signatureFor(String(mediaId), expires));
  const actual = Buffer.from(String(signature));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function storeMarketplaceMedia(file, listingId, memberId) {
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(file.originalname, { contentType: file.mimetype, metadata: { listingId: String(listingId), uploadedBy: String(memberId) } });
    stream.on("error", reject);
    stream.on("finish", () => resolve(stream.id));
    stream.end(file.buffer);
  });
}

export async function deleteMarketplaceMedia(ids = []) {
  await Promise.all(ids.map((id) => bucket().delete(id).catch((error) => { if (error.code !== "ENOENT") throw error; })));
}

export function streamMarketplaceMedia(req, res, media) {
  if (!media) throw httpError(404, "Marketplace media not found");
  res.setHeader("Content-Type", media.mimeType);
  res.setHeader("Content-Length", media.size);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(media.originalName)}`);
  return bucket().openDownloadStream(media.gridFsId).pipe(res);
}
