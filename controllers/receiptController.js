import Counter from "../models/Counter.js";
import Member from "../models/Member.js";
import Receipt from "../models/Receipt.js";
import httpError from "../utils/httpError.js";
import { sendReceiptEmail } from "../services/emailService.js";
import { generateReceiptPdf } from "../services/receiptPdfService.js";

const receiptPopulate = { path: "member", select: "name email phone itsId patrol status" };
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));

async function nextReceiptNumber() {
  const year = new Date().getFullYear();
  const counter = await Counter.findByIdAndUpdate(`receipt-${year}`, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return `SR-${year}-${String(counter.value).padStart(5, "0")}`;
}

function parseReceipt(body) {
  const title = String(body.title || "").trim();
  const amount = Number(body.amount);
  const paymentMode = String(body.paymentMode || "");
  const paidOn = new Date(body.paidOn);
  const paymentReference = String(body.paymentReference || "").trim();
  const notes = String(body.notes || "").trim();
  if (!title) throw httpError(400, "Receipt title is required");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) throw httpError(400, "Enter a valid amount greater than zero");
  if (!new Set(["cash", "online_transfer"]).has(paymentMode)) throw httpError(400, "Choose cash or online transfer");
  if (Number.isNaN(paidOn.getTime())) throw httpError(400, "A valid payment date is required");
  if (paidOn > new Date()) throw httpError(400, "Payment date cannot be in the future");
  if (paymentMode === "online_transfer" && !paymentReference) throw httpError(400, "Transaction reference is required for online transfers");
  return { title, amount: Math.round(amount * 100) / 100, paymentMode, paidOn, paymentReference: paymentMode === "cash" ? "" : paymentReference, notes };
}

async function emailReceipt(receipt) {
  await receipt.populate(receiptPopulate);
  if (!validEmail(receipt.member?.email)) {
    receipt.emailStatus = "not_available";
    receipt.emailError = "Member does not have a valid email address";
    await receipt.save();
    return { sent: false, reason: receipt.emailError };
  }
  try {
    const pdfBuffer = await generateReceiptPdf(receipt);
    await sendReceiptEmail({ email: receipt.member.email, recipientName: receipt.member.name, receipt, pdfBuffer });
    receipt.emailStatus = "sent";
    receipt.emailedAt = new Date();
    receipt.emailError = "";
    await receipt.save();
    return { sent: true };
  } catch (error) {
    receipt.emailStatus = "failed";
    receipt.emailError = error.message;
    await receipt.save();
    return { sent: false, reason: "Receipt created, but email delivery failed. You can retry from the receipt list." };
  }
}

export async function createReceipt(req, res) {
  const member = await Member.findById(req.body.memberId).select("name email phone itsId patrol status");
  if (!member || member.status !== "active") throw httpError(400, "Choose an active member");
  const values = parseReceipt(req.body);
  const receipt = await Receipt.create({ ...values, member: member._id, receiptNumber: await nextReceiptNumber(), issuedBy: req.user.sub });
  receipt.member = member;
  const email = await emailReceipt(receipt);
  res.status(201).json({ success: true, message: email.sent ? "Receipt generated and emailed successfully" : email.reason, receipt, email });
}

export async function listReceipts(req, res) {
  const query = {};
  if (req.user.role === "member") query.member = req.user.sub;
  if (req.query.status && req.query.status !== "all") query.status = req.query.status;
  if (req.query.memberId && req.user.role === "admin") query.member = req.query.memberId;
  const receipts = await Receipt.find(query).populate(receiptPopulate).sort({ createdAt: -1 });
  res.json({ success: true, receipts });
}

async function accessibleReceipt(req) {
  const receipt = await Receipt.findById(req.params.id).populate(receiptPopulate);
  if (!receipt) throw httpError(404, "Receipt not found");
  if (req.user.role === "member" && String(receipt.member?._id) !== String(req.user.sub)) throw httpError(403, "You do not have access to this receipt");
  return receipt;
}

export async function downloadReceipt(req, res) {
  const receipt = await accessibleReceipt(req);
  const pdf = await generateReceiptPdf(receipt);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${receipt.receiptNumber}.pdf"`);
  res.send(pdf);
}

export async function resendReceipt(req, res) {
  const receipt = await accessibleReceipt(req);
  if (receipt.status === "void") throw httpError(400, "A void receipt cannot be emailed");
  const email = await emailReceipt(receipt);
  if (!email.sent) throw httpError(502, email.reason);
  res.json({ success: true, message: "Receipt emailed successfully", receipt });
}

export async function voidReceipt(req, res) {
  const receipt = await accessibleReceipt(req);
  if (receipt.status === "void") throw httpError(400, "Receipt is already void");
  const reason = String(req.body.reason || "").trim();
  if (reason.length < 3) throw httpError(400, "Enter a reason for voiding this receipt");
  receipt.status = "void";
  receipt.voidedAt = new Date();
  receipt.voidReason = reason;
  await receipt.save();
  res.json({ success: true, message: "Receipt voided", receipt });
}
