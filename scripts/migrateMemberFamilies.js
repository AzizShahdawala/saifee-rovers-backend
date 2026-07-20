import "dotenv/config";
import mongoose from "mongoose";
import Member from "../models/Member.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
await mongoose.connect(process.env.MONGO_URI);

try {
  const members = await Member.collection.find({}).sort({ name: 1 }).toArray();
  const operations = members.map((member, index) => {
    const married = index % 2 === 0;
    const family = married ? {
      maritalStatus: "MARRIED",
      spouseName: `Placeholder Spouse ${member.itsId}`,
      spouseDateOfBirth: new Date(Date.UTC(1962, 0, 1) + index * 127 * 24 * 60 * 60 * 1000),
      children: index % 4 === 0 ? [{ name: `Placeholder Child ${member.itsId}`, dateOfBirth: new Date(Date.UTC(1995, 0, 1) + index * 91 * 24 * 60 * 60 * 1000) }] : [],
    } : { maritalStatus: "UNMARRIED", spouseName: "", spouseDateOfBirth: null, children: [] };
    return { updateOne: { filter: { _id: member._id }, update: { $set: family } } };
  });
  if (operations.length) await Member.collection.bulkWrite(operations, { ordered: true });
  await Member.syncIndexes();
  console.log(`Added editable placeholder marital and family details to ${members.length} members.`);
} finally {
  await mongoose.disconnect();
}
