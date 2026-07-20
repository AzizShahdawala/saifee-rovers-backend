import fs from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import Member, { INSTRUMENTS, PATROLS } from "../models/Member.js";
import Attendance from "../models/Attendance.js";
import httpError from "../utils/httpError.js";
import { enrollmentDescriptor } from "../services/faceRecognitionService.js";

const fields = ["memberId", "name", "phone", "email", "patrol", "instrument", "status", "isPatrolLeader"];
const memberBody = (body) => Object.fromEntries(fields.filter((key) => body[key] !== undefined).map((key) => [key, typeof body[key] === "string" ? body[key].trim() : body[key]]));
const isTrue = (value) => value === true || value === "true";
const uniqueRoleError = (error) => {
  if (error?.code === 11000 && error?.keyPattern?.email) {
    return httpError(409, "Another member is already registered with this email address");
  }
  if (error?.code === 11000 && error?.keyPattern?.memberId) return httpError(409, "Another member already uses this member ID");
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
  const enrollmentFiles = req.files || [];
  if (![0, 5].includes(enrollmentFiles.length)) {
    if (req.memberFolder) await fs.rm(path.join("uploads", "members", req.memberFolder), { recursive: true, force: true });
    throw httpError(400, "Face enrollment requires all 5 images, or it can be skipped");
  }
  const data = memberBody(req.body);
  if (!data.name || !data.phone || !data.email || !data.patrol || (data.patrol !== "Officers" && !data.instrument)) throw httpError(400, "Name, phone, email and patrol are required; instrument is required unless the patrol is Officers");
  try {
    await ensureUniqueRoles(data);
    const descriptor = enrollmentFiles.length ? (await enrollmentDescriptor(enrollmentFiles.map((file) => file.path))).descriptor : undefined;
    const member = await Member.create({
      ...data,
      folder: enrollmentFiles.length ? req.memberFolder : undefined,
      images: enrollmentFiles.map((file) => ({ fileName: file.filename, path: file.path })),
      faceEnrolled: enrollmentFiles.length === 5,
      descriptor,
    });
    res.status(201).json({ success: true, member });
  } catch (error) {
    if (req.memberFolder) await fs.rm(path.join("uploads", "members", req.memberFolder), { recursive: true, force: true });
    throw uniqueRoleError(error);
  }
}

export async function enrollMemberFace(req, res) {
  if (!req.files || req.files.length !== 5) {
    if (req.memberFolder) await fs.rm(path.join("uploads", "members", req.memberFolder), { recursive: true, force: true });
    throw httpError(400, "Exactly 5 face images are required for enrollment");
  }
  const member = await Member.findById(req.params.id);
  if (!member) {
    await fs.rm(path.join("uploads", "members", req.memberFolder), { recursive: true, force: true });
    throw httpError(404, "Member not found");
  }
  const previousFolder = member.folder;
  try {
    const { descriptor } = await enrollmentDescriptor(req.files.map((file) => file.path));
    member.folder = req.memberFolder;
    member.images = req.files.map((file) => ({ fileName: file.filename, path: file.path }));
    member.faceEnrolled = true;
    member.descriptor = descriptor;
    await member.save();
    if (previousFolder && previousFolder !== req.memberFolder) await fs.rm(path.join("uploads", "members", previousFolder), { recursive: true, force: true });
    res.json({ success: true, message: "Face enrollment updated successfully", member });
  } catch (error) {
    await fs.rm(path.join("uploads", "members", req.memberFolder), { recursive: true, force: true });
    throw error;
  }
}

export async function listMembers(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.patrol) filter.patrol = req.query.patrol;
  if (req.query.faceEnrolled === "true" || req.query.faceEnrolled === "false") filter.faceEnrolled = req.query.faceEnrolled === "true";
  const members = await Member.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, members });
}

export async function exportMembers(req, res) {
  const members = await Member.find().sort({ name: 1 });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Saifee Rovers";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Members", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  sheet.mergeCells("A1:J1");
  const title = sheet.getCell("A1");
  title.value = "Saifee Rovers Member Directory";
  title.font = { name: "Aptos Display", size: 20, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 34;

  sheet.mergeCells("A2:J2");
  const subtitle = sheet.getCell("A2");
  subtitle.value = `Generated ${new Date().toLocaleString("en-IN")} • ${members.length} members`;
  subtitle.font = { name: "Aptos", size: 10, color: { argb: "FF475569" } };
  subtitle.alignment = { vertical: "middle" };
  sheet.getRow(2).height = 23;

  sheet.columns = [
    { key: "memberId", width: 14 }, { key: "name", width: 30 }, { key: "email", width: 36 },
    { key: "phone", width: 16 }, { key: "patrol", width: 15 }, { key: "role", width: 16 },
    { key: "instrument", width: 18 }, { key: "status", width: 13 }, { key: "face", width: 18 },
    { key: "createdAt", width: 16 },
  ];
  const headers = ["Member ID", "Full Name", "Email", "Phone", "Patrol", "Patrol Role", "Instrument", "Status", "Face Enrollment", "Registered On"];
  sheet.getRow(3).values = headers;
  sheet.getRow(3).height = 26;
  sheet.getRow(3).eachCell((cell) => {
    cell.font = { name: "Aptos", bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F3D6E" } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: "FF0B294A" } } };
  });

  for (const member of members) {
    const row = sheet.addRow({
      memberId: member.memberId, name: member.name, email: member.email, phone: member.phone,
      patrol: member.patrol, role: member.isPatrolLeader ? "Patrol Leader" : "Member",
      instrument: member.instrument || "Not assigned", status: member.status === "inactive" ? "Inactive" : "Active",
      face: member.faceEnrolled ? "Enrolled" : "Not Enrolled", createdAt: member.createdAt,
    });
    row.height = 22;
    row.font = { name: "Aptos", size: 10 };
    row.alignment = { vertical: "middle" };
    if (row.number % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F7FC" } };
    row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFD7E0EA" } } }; });
  }
  sheet.getColumn("memberId").numFmt = "@";
  sheet.getColumn("phone").numFmt = "@";
  sheet.getColumn("createdAt").numFmt = "dd-mmm-yyyy";
  sheet.autoFilter = { from: "A3", to: `J${Math.max(3, members.length + 3)}` };

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="saifee-rovers-members-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  res.send(Buffer.from(buffer));
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
  if (next.patrol !== "Officers" && !next.instrument) throw httpError(400, "Instrument is required unless the patrol is Officers");
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
