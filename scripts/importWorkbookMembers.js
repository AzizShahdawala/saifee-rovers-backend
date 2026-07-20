import "dotenv/config";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import Member, { SHARED_IMPORT_EMAIL } from "../models/Member.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");

const sourceUrl = new URL("../data/workbookMembers.json", import.meta.url);
const members = JSON.parse(await fs.readFile(sourceUrl, "utf8"));

await mongoose.connect(process.env.MONGO_URI);

try {
  const emailIndex = (await Member.collection.indexes()).find((index) => index.name === "email_1");
  if (emailIndex?.unique) await Member.collection.dropIndex("email_1");

  const existingMembers = await Member.find().select("+loginEmailKey");
  for (const member of existingMembers) await member.save();
  await Member.syncIndexes();

  const operations = members.map(({ name, phone, patrol }) => ({
    updateOne: {
      filter: { phone },
      update: {
        $set: { name, patrol },
        $setOnInsert: {
          email: SHARED_IMPORT_EMAIL,
          instrument: "Saxophone",
          isPatrolLeader: false,
          status: patrol === "Sleeping" ? "inactive" : "active",
          faceEnrolled: false,
          images: [],
        },
      },
      upsert: true,
      runValidators: true,
    },
  }));

  const result = await Member.bulkWrite(operations, { ordered: true });
  const importedPhones = members.map(({ phone }) => phone);
  const imported = await Member.find({ phone: { $in: importedPhones } });
  const grouped = imported.reduce((summary, member) => {
    summary[member.patrol] = (summary[member.patrol] || 0) + 1;
    return summary;
  }, {});

  console.log(JSON.stringify({
    workbookRows: members.length,
    matchedExisting: result.matchedCount,
    inserted: result.upsertedCount,
    registered: imported.length,
    patrols: grouped,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
