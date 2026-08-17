import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import EventMedia from "../models/EventMedia.js";

dotenv.config();

const confirmed = process.argv.includes("--confirm");

try {
  await connectDB();
  const database = mongoose.connection.db;
  const [records, gridFsFiles, gridFsChunks] = await Promise.all([
    EventMedia.countDocuments({}),
    database.collection("eventMedia.files").countDocuments({}),
    database.collection("eventMedia.chunks").countDocuments({}),
  ]);

  console.log(JSON.stringify({ mode: confirmed ? "delete" : "dry-run", records, gridFsFiles, gridFsChunks }));

  if (!confirmed) {
    console.log("Dry run only. Re-run with --confirm to permanently remove all event media.");
  } else {
    const [recordResult, fileResult, chunkResult] = await Promise.all([
      EventMedia.deleteMany({}),
      database.collection("eventMedia.files").deleteMany({}),
      database.collection("eventMedia.chunks").deleteMany({}),
    ]);
    const localEventMediaPath = path.resolve("uploads", "events");
    await fs.rm(localEventMediaPath, { recursive: true, force: true });
    console.log(JSON.stringify({
      deletedRecords: recordResult.deletedCount,
      deletedGridFsFiles: fileResult.deletedCount,
      deletedGridFsChunks: chunkResult.deletedCount,
      removedLocalPath: localEventMediaPath,
    }));
  }
} finally {
  await mongoose.disconnect();
}
