import "dotenv/config";
import mongoose from "mongoose";
import Member, { PROFESSIONS } from "../models/Member.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
await mongoose.connect(process.env.MONGO_URI);

try {
  const members = await Member.collection.find({}).sort({ name: 1 }).toArray();
  const baseDate = Date.UTC(1960, 0, 1);
  const descriptions = {
    BUSINESS: "General trading business",
    JOB: "Private-sector employment",
    STUDENT: "General studies",
    RETIRED: "Retired member",
    OTHER: "Community service",
  };
  const operations = members.map((member, index) => {
    const profession = PROFESSIONS[index % PROFESSIONS.length];
    const dateOfBirth = new Date(baseDate + index * 173 * 24 * 60 * 60 * 1000);
    return {
      updateOne: {
        filter: { _id: member._id },
        update: { $set: { dateOfBirth, profession, professionDetails: `${descriptions[profession]} — placeholder ${member.itsId}` } },
      },
    };
  });
  if (operations.length) await Member.collection.bulkWrite(operations, { ordered: true });
  await Member.syncIndexes();
  console.log(`Added distinct placeholder birth dates and profession details to ${members.length} members.`);
} finally {
  await mongoose.disconnect();
}
