import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Member from "../models/Member.js";

await connectDB();
const members = await Member.find({ maritalStatus: "MARRIED", $or: [{ marriageDate: null }, { marriageDate: { $exists: false } }] }).sort({ name: 1 });
const operations = members.map((member, index) => ({
  updateOne: {
    filter: { _id: member._id },
    update: { $set: { marriageDate: new Date(Date.UTC(1988 + (index % 30), index % 12, ((index * 7) % 28) + 1)) } },
  },
}));
if (operations.length) await Member.bulkWrite(operations, { ordered: true });
console.log(JSON.stringify({ updated: operations.length }));
await mongoose.disconnect();
