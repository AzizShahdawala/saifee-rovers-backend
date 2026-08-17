import Member from "../models/Member.js";
import httpError from "../utils/httpError.js";

const startOfDay = (value = new Date()) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const addDays = (value, days) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
const sameDay = (first, second) => first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
const occurrence = (birthDate, year) => new Date(year, birthDate.getUTCMonth(), birthDate.getUTCDate());

const birthdayItem = ({ type, name, birthDate, hijriDateOfBirth, member, relationship }) => {
  if (!birthDate || !name) return null;
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = startOfDay();
  let nextBirthday = occurrence(parsed, today.getFullYear());
  if (nextBirthday < today) nextBirthday = occurrence(parsed, today.getFullYear() + 1);
  return {
    id: `${member._id}-${type}-${relationship || name}`,
    type,
    name,
    relationship,
    memberId: member._id,
    memberName: member.name,
    patrol: member.patrol,
    dateOfBirth: parsed,
    hijriDateOfBirth: hijriDateOfBirth || undefined,
    nextBirthday,
    turningAge: nextBirthday.getFullYear() - parsed.getUTCFullYear(),
    daysAway: Math.round((nextBirthday - today) / 86400000),
  };
};

export async function getBirthdays(req, res) {
  const view = ["today", "week", "month"].includes(req.query.view) ? req.query.view : "today";
  const requestedMonth = req.query.month === undefined ? new Date().getMonth() + 1 : Number(req.query.month);
  if (!Number.isInteger(requestedMonth) || requestedMonth < 1 || requestedMonth > 12) throw httpError(400, "Month must be between 1 and 12");
  const members = await Member.find().select("name patrol dateOfBirth hijriDateOfBirth maritalStatus spouseName spouseDateOfBirth children");
  const all = members.flatMap((member) => {
    const items = [birthdayItem({ type: "MEMBER", name: member.name, birthDate: member.dateOfBirth, hijriDateOfBirth: member.hijriDateOfBirth, member, relationship: "Member" })];
    if (member.maritalStatus === "MARRIED") items.push(birthdayItem({ type: "SPOUSE", name: member.spouseName, birthDate: member.spouseDateOfBirth, member, relationship: `Spouse of ${member.name}` }));
    for (const child of member.children || []) items.push(birthdayItem({ type: "CHILD", name: child.name, birthDate: child.dateOfBirth, member, relationship: `Child of ${member.name}` }));
    return items.filter(Boolean);
  });
  const today = startOfDay();
  const weekEnd = addDays(today, 6);
  const thisYear = today.getFullYear();
  const monthOccurrence = (item, month) => occurrence(new Date(item.dateOfBirth), thisYear).getMonth() === month - 1;
  const summary = {
    today: all.filter((item) => sameDay(new Date(item.dateOfBirth), today)).length,
    week: all.filter((item) => item.nextBirthday >= today && item.nextBirthday <= weekEnd).length,
    month: all.filter((item) => monthOccurrence(item, today.getMonth() + 1)).length,
    totalPeople: all.length,
  };
  const todayBirthdays = all
    .filter((item) => sameDay(new Date(item.dateOfBirth), today))
    .sort((a, b) => a.name.localeCompare(b.name));
  let birthdays;
  if (view === "today") birthdays = all.filter((item) => sameDay(new Date(item.dateOfBirth), today));
  else if (view === "week") birthdays = all.filter((item) => item.nextBirthday >= today && item.nextBirthday <= weekEnd);
  else birthdays = all.filter((item) => monthOccurrence(item, requestedMonth)).map((item) => ({ ...item, nextBirthday: occurrence(new Date(item.dateOfBirth), thisYear), daysAway: Math.round((occurrence(new Date(item.dateOfBirth), thisYear) - today) / 86400000), turningAge: thisYear - new Date(item.dateOfBirth).getUTCFullYear() }));
  birthdays.sort((a, b) => new Date(a.nextBirthday) - new Date(b.nextBirthday) || a.name.localeCompare(b.name));
  res.json({ success: true, birthdays, todayBirthdays, summary, view, month: requestedMonth });
}
