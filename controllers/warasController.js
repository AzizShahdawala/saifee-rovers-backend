import Member from "../models/Member.js";
import httpError from "../utils/httpError.js";
import { gregorianToHijri, hijriParts, hijriToGregorian, isValidHijriDate } from "../utils/hijriDate.js";

const DAY_MS = 86_400_000;
const addDays = (value, days) => new Date(value.getTime() + days * DAY_MS);
const todayInEventTimezone = () => {
  const offset = Number(process.env.EVENT_TIMEZONE_OFFSET_MINUTES || 330);
  const shifted = new Date(Date.now() + offset * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
};
const parseHijri = (value) => {
  if (!isValidHijriDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
};
const nextOccurrence = (hijriDate, today) => {
  const target = parseHijri(hijriDate);
  if (!target) return null;
  for (let offset = 0; offset <= 385; offset += 1) {
    const candidate = addDays(today, offset);
    const parts = hijriParts(candidate);
    if (parts?.month === target.month && parts.day === target.day) return { date: candidate, daysAway: offset, hijriYear: parts.year };
  }
  return null;
};
const warasItem = ({ type, name, hijriDateOfBirth, member, relationship, today }) => {
  if (!name || !isValidHijriDate(hijriDateOfBirth)) return null;
  const birth = parseHijri(hijriDateOfBirth);
  const occurrence = nextOccurrence(hijriDateOfBirth, today);
  if (!occurrence) return null;
  return {
    id: `${member._id}-${type}-${relationship || name}`,
    type,
    name,
    relationship,
    memberId: member._id,
    memberName: member.name,
    patrol: member.patrol,
    hijriDateOfBirth,
    nextWaras: occurrence.date,
    daysAway: occurrence.daysAway,
    turningAge: occurrence.hijriYear - birth.year,
  };
};

export async function getWaras(req, res) {
  const view = ["today", "week", "month"].includes(req.query.view) ? req.query.view : "today";
  const today = todayInEventTimezone();
  const currentHijri = hijriParts(today);
  const requestedMonth = req.query.month === undefined ? currentHijri.month : Number(req.query.month);
  if (!Number.isInteger(requestedMonth) || requestedMonth < 1 || requestedMonth > 12) throw httpError(400, "Hijri month must be between 1 and 12");
  const members = await Member.find().select("name patrol dateOfBirth hijriDateOfBirth maritalStatus spouseName spouseDateOfBirth children");
  const all = members.flatMap((member) => {
    const items = [warasItem({ type: "MEMBER", name: member.name, hijriDateOfBirth: member.hijriDateOfBirth || gregorianToHijri(member.dateOfBirth), member, relationship: "Member", today })];
    if (member.maritalStatus === "MARRIED") items.push(warasItem({ type: "SPOUSE", name: member.spouseName, hijriDateOfBirth: gregorianToHijri(member.spouseDateOfBirth), member, relationship: `Spouse of ${member.name}`, today }));
    for (const child of member.children || []) items.push(warasItem({ type: "CHILD", name: child.name, hijriDateOfBirth: gregorianToHijri(child.dateOfBirth), member, relationship: `Child of ${member.name}`, today }));
    return items.filter(Boolean);
  });
  const inMonth = (item, month) => parseHijri(item.hijriDateOfBirth)?.month === month;
  const summary = {
    today: all.filter((item) => item.daysAway === 0).length,
    week: all.filter((item) => item.daysAway <= 6).length,
    month: all.filter((item) => inMonth(item, currentHijri.month)).length,
    totalPeople: all.length,
  };
  const todayWaras = all.filter((item) => item.daysAway === 0).sort((a, b) => a.name.localeCompare(b.name));
  let waras;
  if (view === "today") waras = todayWaras;
  else if (view === "week") waras = all.filter((item) => item.daysAway <= 6);
  else {
    waras = all.filter((item) => inMonth(item, requestedMonth)).map((item) => {
      const birth = parseHijri(item.hijriDateOfBirth);
      const date = hijriToGregorian(currentHijri.year, requestedMonth, birth.day) || item.nextWaras;
      return { ...item, nextWaras: date, daysAway: Math.round((date - today) / DAY_MS), turningAge: currentHijri.year - birth.year };
    });
  }
  waras.sort((a, b) => new Date(a.nextWaras) - new Date(b.nextWaras) || a.name.localeCompare(b.name));
  res.json({ success: true, waras, todayWaras, summary, view, month: requestedMonth, currentHijriDate: currentHijri.canonical });
}
