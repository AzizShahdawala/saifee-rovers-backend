import mongoose from "mongoose";
import MarketplaceListing from "../models/MarketplaceListing.js";
import Member from "../models/Member.js";
import httpError from "../utils/httpError.js";
import { createMemberNotification } from "../services/notificationService.js";
import { deleteMarketplaceMedia, marketplaceMediaLink, storeMarketplaceMedia, streamMarketplaceMedia, verifyMarketplaceMediaLink } from "../services/marketplaceMediaStorageService.js";

const memberFields = "name patrol profilePhoto images";
const populateListing = (query) => query.populate("seller", memberFields).populate("buyer", memberFields).populate("comments.author", memberFields);
const isId = (value) => mongoose.isValidObjectId(value);
const memberId = (req) => String(req.user.sub);

function present(listing) {
  const value = listing.toJSON();
  value.media = value.media.map((media) => ({ ...media, url: marketplaceMediaLink(value._id, media._id) }));
  return value;
}

async function findListing(id) {
  if (!isId(id)) throw httpError(404, "Marketplace listing not found");
  const listing = await populateListing(MarketplaceListing.findById(id));
  if (!listing) throw httpError(404, "Marketplace listing not found");
  return listing;
}

export async function listMarketplace(req, res) {
  const filter = {};
  if (req.query.scope === "mine") filter.seller = memberId(req);
  if (req.query.scope === "purchases") filter.buyer = memberId(req);
  if (["available", "reserved", "sold", "donated", "withdrawn"].includes(req.query.status)) filter.status = req.query.status;
  if (["sale", "donation"].includes(req.query.type)) filter.listingType = req.query.type;
  const search = String(req.query.search || "").trim();
  if (search) filter.$text = { $search: search };
  const listings = await populateListing(MarketplaceListing.find(filter).sort({ createdAt: -1 }).limit(200));
  res.json({ success: true, listings: listings.map(present) });
}

export async function getMarketplaceListing(req, res) {
  res.json({ success: true, listing: present(await findListing(req.params.id)) });
}

export async function createMarketplaceListing(req, res) {
  if (req.user.role !== "member") throw httpError(403, "Only members can post marketplace listings");
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const listingType = req.body.listingType;
  const price = listingType === "donation" ? 0 : Number(req.body.price);
  if (!title || !description || !["sale", "donation"].includes(listingType)) throw httpError(400, "Title, description and listing type are required");
  if (listingType === "sale" && (!Number.isFinite(price) || price < 0)) throw httpError(400, "Enter a valid asking price");
  if (!req.files?.length) throw httpError(400, "Add at least one photo or video");
  if (req.files.reduce((total, file) => total + file.size, 0) > 4 * 1024 * 1024) throw httpError(400, "Photos and videos must be 4 MB or less in total");

  const listing = new MarketplaceListing({ seller: memberId(req), title, description, listingType, price });
  const storedIds = [];
  try {
    for (const file of req.files) {
      const gridFsId = await storeMarketplaceMedia(file, listing._id, memberId(req));
      storedIds.push(gridFsId);
      listing.media.push({ mediaType: file.mimetype.startsWith("video/") ? "video" : "image", originalName: file.originalname, mimeType: file.mimetype, size: file.size, gridFsId });
    }
    await listing.save();
  } catch (error) {
    await deleteMarketplaceMedia(storedIds);
    throw error;
  }
  res.status(201).json({ success: true, listing: present(await findListing(listing._id)) });
}

export async function addMarketplaceComment(req, res) {
  if (req.user.role !== "member") throw httpError(403, "Only members can join marketplace discussions");
  const text = String(req.body.text || "").trim();
  if (!text || text.length > 1000) throw httpError(400, "Comment must contain between 1 and 1000 characters");
  const listing = await findListing(req.params.id);
  if (listing.status === "withdrawn") throw httpError(409, "This listing is no longer open for discussion");
  listing.comments.push({ author: memberId(req), text });
  await listing.save();
  if (String(listing.seller._id) !== memberId(req)) {
    const author = await Member.findById(memberId(req)).select("name");
    await createMemberNotification(listing.seller._id, { type: "marketplace", title: "New marketplace comment", message: `${author?.name || "A member"} commented on ${listing.title}.`, link: "/member/marketplace", dedupeKey: `marketplace:${listing._id}:comment:${listing.comments.at(-1)._id}` });
  }
  res.status(201).json({ success: true, listing: present(await findListing(listing._id)) });
}

export async function deleteMarketplaceComment(req, res) {
  const listing = await findListing(req.params.id);
  const comment = listing.comments.id(req.params.commentId);
  if (!comment) throw httpError(404, "Comment not found");
  if (req.user.role !== "admin" && String(comment.author._id || comment.author) !== memberId(req)) throw httpError(403, "You can only remove your own comments");
  listing.comments.pull(comment._id);
  await listing.save();
  res.json({ success: true, listing: present(await findListing(listing._id)) });
}

export async function updateMarketplaceStatus(req, res) {
  const listing = await findListing(req.params.id);
  if (req.user.role !== "admin" && String(listing.seller._id) !== memberId(req)) throw httpError(403, "Only the seller can update this listing");
  const status = req.body.status;
  if (!["available", "reserved", "sold", "donated", "withdrawn"].includes(status)) throw httpError(400, "Invalid listing status");
  if ((listing.listingType === "sale" && status === "donated") || (listing.listingType === "donation" && status === "sold")) throw httpError(400, "Status does not match the listing type");
  let buyer = null;
  if (["reserved", "sold", "donated"].includes(status)) {
    if (!isId(req.body.buyerId)) throw httpError(400, "Select the member receiving this item");
    buyer = await Member.findOne({ _id: req.body.buyerId, status: "active" }).select("name");
    if (!buyer) throw httpError(400, "Selected buyer is not an active member");
    if (String(buyer._id) === String(listing.seller._id)) throw httpError(400, "Seller and buyer cannot be the same member");
  }
  listing.status = status;
  listing.buyer = buyer?._id || null;
  listing.completedAt = ["sold", "donated"].includes(status) ? new Date() : null;
  await listing.save();
  if (buyer) await createMemberNotification(buyer._id, { type: "marketplace", title: `Item ${status}`, message: `${listing.title} has been marked ${status} for you.`, link: "/member/marketplace", dedupeKey: `marketplace:${listing._id}:${status}:${buyer._id}` });
  res.json({ success: true, listing: present(await findListing(listing._id)) });
}

export async function updateMarketplaceListing(req, res) {
  const listing = await findListing(req.params.id);
  if (req.user.role !== "member" || String(listing.seller._id) !== memberId(req)) throw httpError(403, "Only the seller can edit this listing");
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const listingType = req.body.listingType;
  const price = listingType === "donation" ? 0 : Number(req.body.price);
  if (!title || !description || !["sale", "donation"].includes(listingType)) throw httpError(400, "Title, description and listing type are required");
  if (listingType === "sale" && (!Number.isFinite(price) || price < 0)) throw httpError(400, "Enter a valid asking price");
  if (["sold", "donated"].includes(listing.status) && (listingType !== listing.listingType || price !== listing.price)) throw httpError(409, "The offer type and price of a completed transaction cannot be changed");
  listing.title = title;
  listing.description = description;
  listing.listingType = listingType;
  listing.price = price;
  await listing.save();
  res.json({ success: true, listing: present(await findListing(listing._id)) });
}

export async function deleteMarketplaceListing(req, res) {
  const listing = await findListing(req.params.id);
  if (req.user.role !== "member" || String(listing.seller._id) !== memberId(req)) throw httpError(403, "Only the seller can delete this listing");
  if (["sold", "donated"].includes(listing.status)) throw httpError(409, "Sold or donated listings must remain in transaction history");
  const mediaIds = listing.media.map((media) => media.gridFsId);
  await MarketplaceListing.deleteOne({ _id: listing._id });
  await deleteMarketplaceMedia(mediaIds);
  res.json({ success: true, message: "Marketplace listing deleted" });
}

export async function streamMarketplaceListingMedia(req, res) {
  if (!verifyMarketplaceMediaLink(req.params.mediaId, req.query.expires, req.query.signature)) throw httpError(403, "Media link is invalid or expired");
  const listing = await MarketplaceListing.findById(req.params.id);
  const media = listing?.media.id(req.params.mediaId);
  streamMarketplaceMedia(req, res, media);
}
