import Member from "../models/Member.js";
import httpError from "../utils/httpError.js";

const startOfDay = (value = new Date()) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const addDays = (value, days) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
const occurrence = (date, year) => new Date(year, date.getUTCMonth(), date.getUTCDate());
const sameDay = (first, second) => first.getUTCMonth() === second.getMonth() && first.getUTCDate() === second.getDate();

const anniversaryItem = (member, today) => {
  if (member.maritalStatus !== "MARRIED" || !member.marriageDate || !member.spouseName) return null;
  const marriageDate = new Date(member.marriageDate);
  let nextAnniversary = occurrence(marriageDate, today.getFullYear());
  if (nextAnniversary < today) nextAnniversary = occurrence(marriageDate, today.getFullYear() + 1);
  return {
    id: String(member._id), memberId: member._id, memberName: member.name, spouseName: member.spouseName,
    coupleName: `${member.name} & ${member.spouseName}`, patrol: member.patrol, marriageDate,
    nextAnniversary, years: nextAnniversary.getFullYear() - marriageDate.getUTCFullYear(),
    daysAway: Math.round((nextAnniversary - today) / 86400000),
  };
};

export async function getAnniversaries(req, res) {
  const view = ["today", "week", "month"].includes(req.query.view) ? req.query.view : "today";
  const requestedMonth = req.query.month === undefined ? new Date().getMonth() + 1 : Number(req.query.month);
  if (!Number.isInteger(requestedMonth) || requestedMonth < 1 || requestedMonth > 12) throw httpError(400, "Month must be between 1 and 12");
  const today = startOfDay();
  const members = await Member.find({ maritalStatus: "MARRIED", marriageDate: { $ne: null } }).select("name spouseName patrol maritalStatus marriageDate");
  const all = members.map((member) => anniversaryItem(member, today)).filter(Boolean);
  const weekEnd = addDays(today, 6);
  const selectedYear = today.getFullYear();
  const inMonth = (item, month) => new Date(item.marriageDate).getUTCMonth() === month - 1;
  const summary = {
    today: all.filter((item) => sameDay(new Date(item.marriageDate), today)).length,
    week: all.filter((item) => item.nextAnniversary >= today && item.nextAnniversary <= weekEnd).length,
    month: all.filter((item) => inMonth(item, today.getMonth() + 1)).length,
    totalCouples: all.length,
  };
  const todayAnniversaries = all.filter((item) => sameDay(new Date(item.marriageDate), today)).sort((a, b) => a.coupleName.localeCompare(b.coupleName));
  let anniversaries;
  if (view === "today") anniversaries = todayAnniversaries;
  else if (view === "week") anniversaries = all.filter((item) => item.nextAnniversary >= today && item.nextAnniversary <= weekEnd);
  else anniversaries = all.filter((item) => inMonth(item, requestedMonth)).map((item) => {
    const nextAnniversary = occurrence(new Date(item.marriageDate), selectedYear);
    return { ...item, nextAnniversary, daysAway: Math.round((nextAnniversary - today) / 86400000), years: selectedYear - new Date(item.marriageDate).getUTCFullYear() };
  });
  anniversaries.sort((a, b) => new Date(a.nextAnniversary) - new Date(b.nextAnniversary) || a.coupleName.localeCompare(b.coupleName));
  res.json({ success: true, anniversaries, todayAnniversaries, summary, view, month: requestedMonth });
}
