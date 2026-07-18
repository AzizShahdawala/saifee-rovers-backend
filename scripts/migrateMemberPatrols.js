import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Member, { PATROLS } from "../models/Member.js";

dotenv.config();
await connectDB();
const aliases = Object.fromEntries(PATROLS.map((patrol) => [patrol.toLowerCase(), patrol]));
const defaulted = await Member.updateMany({ isPatrolLeader: { $exists: false } }, { $set: { isPatrolLeader: false } });
const members = await Member.find({});
let updated = defaulted.modifiedCount;
for (const member of members) {
  const patrol = aliases[String(member.patrol || "").trim().toLowerCase()];
  if (!patrol) throw new Error(`Member ${member._id} has unsupported patrol: ${member.patrol}`);
  if (member.patrol !== patrol) {
    member.patrol = patrol;
    await member.save();
    updated += 1;
  }
}
await Member.syncIndexes();
console.log(`Patrol migration complete. ${updated} member(s) updated.`);
await mongoose.disconnect();
