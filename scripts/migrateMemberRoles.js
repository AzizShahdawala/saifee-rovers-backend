import "dotenv/config";
import mongoose from "mongoose";
import Member from "../models/Member.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
await mongoose.connect(process.env.MONGO_URI);

try {
  const members = await Member.find().select("+patrolLeaderKey +bandInspectorKey");
  for (const member of members) await member.save();
  await Member.syncIndexes();
  console.log(`Member role fields and unique indexes synchronized for ${members.length} members.`);
} finally {
  await mongoose.disconnect();
}
