import "dotenv/config";
import mongoose from "mongoose";
import Event from "../models/Event.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
await mongoose.connect(process.env.MONGO_URI);

try {
  const result = await Event.collection.updateMany({ capacity: { $exists: true } }, { $unset: { capacity: "" } });
  console.log(`Removed capacity from ${result.modifiedCount} stored event(s).`);
} finally {
  await mongoose.disconnect();
}
