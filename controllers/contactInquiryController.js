import AdminUser from "../models/AdminUser.js";
import ContactInquiry from "../models/ContactInquiry.js";
import Counter from "../models/Counter.js";
import httpError from "../utils/httpError.js";
import { sendContactInquiryEmail } from "../services/emailService.js";

const clean = (value) => String(value || "").trim();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s()-]{7,22}$/;

async function nextReference() {
  const year = new Date().getFullYear();
  const counter = await Counter.findByIdAndUpdate(`inquiry-${year}`, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return `INV-${year}-${String(counter.value).padStart(4, "0")}`;
}

async function notifyAdmins(inquiry) {
  const admins = await AdminUser.find({ active: true }).select("name email").lean();
  if (!admins.length) return { status: "failed", sent: [], error: "No active admin recipients configured" };
  const results = await Promise.allSettled(admins.map((admin) => sendContactInquiryEmail({ email: admin.email, adminName: admin.name, inquiry })));
  const sent = admins.filter((_, index) => results[index].status === "fulfilled").map((admin) => admin.email);
  const failures = results.filter((result) => result.status === "rejected").map((result) => result.reason?.message || "Email delivery failed");
  return { status: sent.length === admins.length ? "sent" : sent.length ? "partial" : "failed", sent, error: failures.join("; ").slice(0, 1000) };
}

export async function createContactInquiry(req, res) {
  if (clean(req.body.website)) return res.status(202).json({ success: true, message: "Thank you. Your request has been received." });
  const name = clean(req.body.name); const phone = clean(req.body.phone); const email = clean(req.body.email).toLowerCase();
  const eventTitle = clean(req.body.eventTitle); const eventDescription = clean(req.body.eventDescription); const eventDate = req.body.eventDate ? new Date(req.body.eventDate) : undefined;
  if (name.length < 2 || name.length > 100) throw httpError(400, "Enter your full name");
  if (!phonePattern.test(phone)) throw httpError(400, "Enter a valid phone number");
  if (email && !emailPattern.test(email)) throw httpError(400, "Enter a valid email address");
  if (eventTitle.length < 3 || eventTitle.length > 140) throw httpError(400, "Enter a valid event title");
  if (eventDescription.length < 20 || eventDescription.length > 2000) throw httpError(400, "Describe the event in at least 20 characters");
  if (eventDate && Number.isNaN(eventDate.getTime())) throw httpError(400, "Enter a valid event date");
  const recentCount = await ContactInquiry.countDocuments({ phone, createdAt: { $gte: new Date(Date.now() - 60 * 60_000) } });
  if (recentCount >= 3) throw httpError(429, "We already received your requests. Please wait before submitting again");
  const inquiry = await ContactInquiry.create({ referenceNumber: await nextReference(), name, phone, email, eventTitle, eventDescription, eventDate, sourceIp: clean(req.ip) });
  const delivery = await notifyAdmins(inquiry);
  inquiry.adminEmailStatus = delivery.status; inquiry.emailedAdmins = delivery.sent; inquiry.emailError = delivery.error; await inquiry.save();
  res.status(201).json({ success: true, message: "Thank you for inviting Saifee Rovers. Our team will contact you soon.", referenceNumber: inquiry.referenceNumber });
}

export async function listContactInquiries(req, res) {
  const query = req.query.status && req.query.status !== "all" ? { status: req.query.status } : {};
  const inquiries = await ContactInquiry.find(query).sort({ createdAt: -1 });
  res.json({ success: true, inquiries });
}

export async function updateContactInquiry(req, res) {
  if (!["new", "contacted", "closed"].includes(req.body.status)) throw httpError(400, "Choose a valid enquiry status");
  const inquiry = await ContactInquiry.findById(req.params.id);
  if (!inquiry) throw httpError(404, "Enquiry not found");
  inquiry.status = req.body.status; inquiry.handledBy = req.user.sub; inquiry.handledAt = new Date(); await inquiry.save();
  res.json({ success: true, message: "Enquiry updated", inquiry });
}

export async function resendContactInquiry(req, res) {
  const inquiry = await ContactInquiry.findById(req.params.id);
  if (!inquiry) throw httpError(404, "Enquiry not found");
  const delivery = await notifyAdmins(inquiry);
  inquiry.adminEmailStatus = delivery.status; inquiry.emailedAdmins = delivery.sent; inquiry.emailError = delivery.error; await inquiry.save();
  if (delivery.status === "failed") throw httpError(502, "Unable to email the admin group");
  res.json({ success: true, message: "Enquiry emailed to the admin group", inquiry });
}
