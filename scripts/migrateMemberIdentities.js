import "dotenv/config";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Member from "../models/Member.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
await mongoose.connect(process.env.MONGO_URI);

try {
  const members = await Member.find().sort({ createdAt: 1 });
  const usedIds = new Set();
  const nextId = () => {
    let value;
    do value = String(crypto.randomInt(10_000_000, 100_000_000)); while (usedIds.has(value));
    usedIds.add(value);
    return value;
  };

  const indexes = await Member.collection.indexes();
  if (indexes.some((index) => index.name === "loginEmailKey_1")) await Member.collection.dropIndex("loginEmailKey_1");

  const operations = members.map((member) => {
    const memberId = /^\d{8}$/.test(member.memberId || "") && !usedIds.has(member.memberId) ? (usedIds.add(member.memberId), member.memberId) : nextId();
    return {
      updateOne: {
        filter: { _id: member._id },
        update: {
          $set: { memberId, email: `member.${memberId}@saifeerovers.local` },
          $unset: { loginEmailKey: "" },
        },
      },
    };
  });
  if (operations.length) await Member.bulkWrite(operations, { ordered: true });
  await Member.syncIndexes();
  console.log(`Assigned unique emails and eight-digit IDs to ${members.length} members.`);
} finally {
  await mongoose.disconnect();
}
