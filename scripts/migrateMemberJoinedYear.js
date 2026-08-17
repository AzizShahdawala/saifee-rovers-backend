import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Member, { DEFAULT_JOINED_YEAR } from "../models/Member.js";

dotenv.config();

try {
  await connectDB();
  const result = await Member.updateMany(
    { $or: [{ joinedYear: { $exists: false } }, { joinedYear: null }] },
    { $set: { joinedYear: DEFAULT_JOINED_YEAR } },
  );
  console.log(JSON.stringify({ matched: result.matchedCount, updated: result.modifiedCount, joinedYear: DEFAULT_JOINED_YEAR }));
} finally {
  await mongoose.disconnect();
}
