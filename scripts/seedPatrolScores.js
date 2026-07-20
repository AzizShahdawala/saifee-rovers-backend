import "dotenv/config";
import mongoose from "mongoose";
import PatrolScore, { SCORE_PATROLS } from "../models/PatrolScore.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
await mongoose.connect(process.env.MONGO_URI);

try {
  const existing = await PatrolScore.countDocuments({ reason: /^Initial scoreboard sample:/ });
  if (existing) {
    console.log(`Sample patrol scores already exist (${existing} entries).`);
  } else {
    const now = new Date();
    const entries = SCORE_PATROLS.flatMap((patrol, index) => [
      { patrol, points: 15 + ((index * 7) % 21), reason: `Initial scoreboard sample: participation award for ${patrol}`, date: new Date(Date.UTC(now.getUTCFullYear(), Math.max(0, now.getUTCMonth() - 2), 4 + index)) },
      { patrol, points: 8 + ((index * 5) % 13), reason: `Initial scoreboard sample: teamwork recognition for ${patrol}`, date: new Date(Date.UTC(now.getUTCFullYear(), Math.max(0, now.getUTCMonth() - 1), 8 + index)) },
      { patrol, points: -(2 + (index % 5)), reason: `Initial scoreboard sample: conduct adjustment for ${patrol}`, date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 2 + index)) },
    ]);
    await PatrolScore.insertMany(entries);
    console.log(`Created ${entries.length} sample patrol score entries.`);
  }
} finally {
  await mongoose.disconnect();
}
