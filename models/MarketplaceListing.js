import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
  mediaType: { type: String, enum: ["image", "video"], required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  gridFsId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { _id: true });

const commentSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true });

const marketplaceListingSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  listingType: { type: String, enum: ["sale", "donation"], required: true, index: true },
  price: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["available", "reserved", "sold", "donated", "withdrawn"], default: "available", index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "Member", default: null, index: true },
  completedAt: { type: Date, default: null },
  media: { type: [mediaSchema], default: [] },
  comments: { type: [commentSchema], default: [] },
}, { timestamps: true });

marketplaceListingSchema.index({ createdAt: -1 });
marketplaceListingSchema.index({ title: "text", description: "text" });
export default mongoose.model("MarketplaceListing", marketplaceListingSchema);
