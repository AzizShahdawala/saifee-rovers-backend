import mongoose from "mongoose";
import { PATROLS } from "./Member.js";

export const EXCLUDED_SCORE_PATROLS = ["OFFICERS", "NRI", "SLEEPING"];
export const SCORE_PATROLS = PATROLS.filter((patrol) => !EXCLUDED_SCORE_PATROLS.includes(patrol));

const patrolScoreSchema = new mongoose.Schema({
  patrol: { type: String, required: true, enum: SCORE_PATROLS, index: true },
  points: { type: Number, required: true, min: -10000, max: 10000, validate: { validator: (value) => Number.isInteger(value) && value !== 0, message: "Points must be a non-zero whole number" } },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  date: { type: Date, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
}, { timestamps: true });

patrolScoreSchema.index({ patrol: 1, date: -1 });

export default mongoose.model("PatrolScore", patrolScoreSchema);
