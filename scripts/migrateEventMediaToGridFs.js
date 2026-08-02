import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import EventMedia from "../models/EventMedia.js";
import { storeEventMediaFile } from "../services/eventMediaStorageService.js";

await connectDB();
const media = await EventMedia.find({ storage: { $ne: "gridfs" } });
let migrated = 0;
let unavailable = 0;

for (const item of media) {
  const filePath = item.path ? path.resolve(item.path) : "";
  if (!filePath || !fs.existsSync(filePath)) {
    item.available = false;
    await item.save();
    unavailable += 1;
    continue;
  }
  const gridFsId = await storeEventMediaFile(filePath, {
    fileName: item.originalName,
    mimeType: item.mimeType,
    metadata: { eventId: String(item.event), migratedFrom: item.path },
  });
  item.storage = "gridfs";
  item.gridFsId = gridFsId;
  item.available = true;
  await item.save();
  migrated += 1;
}

console.log(JSON.stringify({ scanned: media.length, migrated, unavailable }));
await mongoose.disconnect();
