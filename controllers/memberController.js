import fs from "fs/promises";
import path from "path";
import Member from "../models/Member.js";
import Attendance from "../models/Attendance.js";
import httpError from "../utils/httpError.js";
import { enrollmentDescriptor } from "../services/faceRecognitionService.js";

const fields = ["name", "phone", "email", "patrol", "status"];
const memberBody = (body) => Object.fromEntries(fields.filter((key) => body[key] !== undefined).map((key) => [key, typeof body[key] === "string" ? body[key].trim() : body[key]]));

export async function registerMember(req, res) {
  if (!req.files || req.files.length !== 5) throw httpError(400, "Exactly 5 images are required");
  const data = memberBody(req.body);
  if (!data.name || !data.phone || !data.email || !data.patrol) throw httpError(400, "Name, phone, email and patrol are required");
  try {
    const { descriptor } = await enrollmentDescriptor(req.files.map((file) => file.path));
    const member = await Member.create({
      ...data,
      folder: req.memberFolder,
      images: req.files.map((file) => ({ fileName: file.filename, path: file.path })),
      faceEnrolled: true,
      descriptor,
    });
    res.status(201).json({ success: true, member });
  } catch (error) {
    if (req.memberFolder) await fs.rm(path.join("uploads", "members", req.memberFolder), { recursive: true, force: true });
    throw error;
  }
}

export async function createMember(req, res) {
  const data = memberBody(req.body);
  if (!data.name) throw httpError(400, "Name is required");
  const member = await Member.create(data);
  res.status(201).json({ success: true, member });
}

export async function listMembers(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.patrol) filter.patrol = req.query.patrol;
  const members = await Member.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, members });
}

export async function getMember(req, res) {
  const member = await Member.findById(req.params.id);
  if (!member) throw httpError(404, "Member not found");
  res.json({ success: true, member });
}

export async function updateMember(req, res) {
  const member = await Member.findByIdAndUpdate(req.params.id, memberBody(req.body), { new: true, runValidators: true });
  if (!member) throw httpError(404, "Member not found");
  res.json({ success: true, member });
}

export async function deleteMember(req, res) {
  const member = await Member.findByIdAndDelete(req.params.id);
  if (!member) throw httpError(404, "Member not found");
  await Attendance.deleteMany({ member: member._id });
  if (member.folder) await fs.rm(path.join("uploads", "members", member.folder), { recursive: true, force: true });
  res.json({ success: true, message: "Member deleted" });
}
