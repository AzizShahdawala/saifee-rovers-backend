import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import { syncEventStatuses } from "../services/eventStatusService.js";

dotenv.config();
await connectDB();
const updated = await syncEventStatuses();
console.log(`Event status sync complete. ${updated} event(s) updated.`);
await mongoose.disconnect();
