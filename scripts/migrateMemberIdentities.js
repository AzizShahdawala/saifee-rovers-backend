import "dotenv/config";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Member from "../models/Member.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
await mongoose.connect(process.env.MONGO_URI);

try {
  const members = await Member.collection.find({}).sort({ createdAt: 1 }).toArray();
  const usedIds = new Set();
  const nextId = () => {
    let value;
    do value = String(crypto.randomInt(10_000_000, 100_000_000)); while (usedIds.has(value));
    usedIds.add(value);
    return value;
  };

  const indexes = await Member.collection.indexes();
  if (indexes.some((index) => index.name === "loginEmailKey_1")) await Member.collection.dropIndex("loginEmailKey_1");
  if (indexes.some((index) => index.name === "memberId_1")) await Member.collection.dropIndex("memberId_1");

  const operations = members.map((member) => {
    const currentId = member.itsId || member.memberId;
    const itsId = /^\d{8}$/.test(currentId || "") && !usedIds.has(currentId) ? (usedIds.add(currentId), currentId) : nextId();
    return {
      updateOne: {
        filter: { _id: member._id },
        update: {
          $set: { itsId, email: `member.${itsId}@saifeerovers.local` },
          $unset: { loginEmailKey: "", memberId: "" },
        },
      },
    };
  });
  if (operations.length) await Member.collection.bulkWrite(operations, { ordered: true });
  await Member.syncIndexes();
  console.log(`Assigned unique emails and eight-digit ITS IDs to ${members.length} members.`);
} finally {
  await mongoose.disconnect();
}
