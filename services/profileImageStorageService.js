import fs from "fs";
import { Readable } from "stream";
import mongoose from "mongoose";
import httpError from "../utils/httpError.js";

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "profileImages" });

function store(source, { fileName, mimeType, ownerType, ownerId }) {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(fileName, {
      contentType: mimeType,
      metadata: { ownerType, ownerId: String(ownerId) },
    });
    source.on("error", reject);
    upload.on("error", reject);
    upload.on("finish", () => resolve(upload.id));
    source.pipe(upload);
  });
}

export function storeProfileImageBuffer(file, metadata) {
  return store(Readable.from(file.buffer), {
    fileName: file.originalname,
    mimeType: file.mimetype,
    ...metadata,
  });
}

export function storeProfileImageFile(file, metadata) {
  return store(fs.createReadStream(file.path), {
    fileName: file.originalname,
    mimeType: file.mimetype,
    ...metadata,
  });
}

export async function deleteProfileImage(image) {
  if (!image?.gridFsId) return;
  await bucket().delete(image.gridFsId).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function streamProfileImage(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Profile image not found");
  const id = new mongoose.Types.ObjectId(req.params.id);
  const [file] = await bucket().find({ _id: id }).limit(1).toArray();
  if (!file) throw httpError(404, "Profile image not found");
  res.setHeader("Content-Type", file.contentType || "application/octet-stream");
  res.setHeader("Content-Length", file.length);
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  return bucket().openDownloadStream(id).pipe(res);
}
