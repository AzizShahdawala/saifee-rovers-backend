import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { backfillMemberMetadata } from "../services/memberHistoryService.js";

try {
  await connectDB();
  const result = await backfillMemberMetadata();
  console.log(JSON.stringify(result));
} finally {
  await mongoose.disconnect();
}
