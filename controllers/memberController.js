import fs from "fs/promises";
import path from "path";
import Member, { INSTRUMENTS, PATROLS } from "../models/Member.js";
import Attendance from "../models/Attendance.js";
import httpError from "../utils/httpError.js";
import { enrollmentDescriptor } from "../services/faceRecognitionService.js";

const fields = ["name", "phone", "email", "patrol", "instrument", "status", "isPatrolLeader"];
const memberBody = (body) => Object.fromEntries(fields.filter((key) => body[key] !== undefined).map((key) => [key, typeof body[key] === "string" ? body[key].trim() : body[key]]));
const isTrue = (value) => value === true || value === "true";
const uniqueRoleError = (error) => {
  if (error?.code !== 11000) return error;
  if (error.keyPattern?.patrolLeaderKey) return httpError(409, "This patrol already has a patrol leader");
  if (error.keyPattern?.bandInspectorKey) return httpError(409, "Band Inspector is already assigned to another member");
  return error;
};

async function ensureUniqueRoles({ patrol, isPatrolLeader, instrument, excludeId }) {
  if (!PATROLS.includes(patrol)) throw httpError(400, `Patrol must be one of: ${PATROLS.join(", ")}`);
  if (instrument && !INSTRUMENTS.includes(instrument)) throw httpError(400, `Instrument must be one of: ${INSTRUMENTS.join(", ")}`);
  const excludingCurrent = excludeId ? { _id: { $ne: excludeId } } : {};
  if (isTrue(isPatrolLeader)) {
    const existingLeader = await Member.findOne({ patrol, isPatrolLeader: true, ...excludingCurrent });
    if (existingLeader) throw httpError(409, `${patrol} patrol already has a leader: ${existingLeader.name}`);
  }
  if (instrument === "Band Inspector") {
    const existingInspector = await Member.findOne({ instrument: "Band Inspector", ...excludingCurrent });
    if (existingInspector) throw httpError(409, `Band Inspector is already assigned to ${existingInspector.name}`);
  }
}

export async function registerMember(req, res) {
  if (!req.files || req.files.length !== 5) throw httpError(400, "Exactly 5 images are required");
  const data = memberBody(req.body);
  if (!data.name || !data.phone || !data.email || !data.patrol || !data.instrument) throw httpError(400, "Name, phone, email, patrol and instrument are required");
  try {
    await ensureUniqueRoles(data);
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
    throw uniqueRoleError(error);
  }
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
  const member = await Member.findById(req.params.id);
  if (!member) throw httpError(404, "Member not found");
  if (req.body.expectedUpdatedAt) {
    const expectedUpdatedAt = new Date(req.body.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.getTime()) || expectedUpdatedAt.getTime() !== member.updatedAt.getTime()) {
      throw httpError(409, "This member was changed after you opened it. Close the dialog, reload the member list, and review the latest details");
    }
  }
  const data = memberBody(req.body);
  const next = { patrol: data.patrol ?? member.patrol, instrument: data.instrument ?? member.instrument, isPatrolLeader: data.isPatrolLeader ?? member.isPatrolLeader };
  if (!next.instrument) throw httpError(400, "Instrument is required");
  await ensureUniqueRoles({ ...next, excludeId: member._id });
  member.set(data);
  try {
    await member.save();
  } catch (error) {
    throw uniqueRoleError(error);
  }
  res.json({ success: true, member });
}

export async function deleteMember(req, res) {
  const member = await Member.findByIdAndDelete(req.params.id);
  if (!member) throw httpError(404, "Member not found");
  await Attendance.deleteMany({ member: member._id });
  if (member.folder) await fs.rm(path.join("uploads", "members", member.folder), { recursive: true, force: true });
  await fs.rm(path.join("uploads", "members", String(member._id)), { recursive: true, force: true });
  res.json({ success: true, message: "Member deleted" });
}
