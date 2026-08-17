import Member, { DEFAULT_JOINED_YEAR } from "../models/Member.js";
import { BOHRA_CALENDAR_VERSION, gregorianToHijri } from "../utils/hijriDate.js";

export const joinedYearStart = (year = DEFAULT_JOINED_YEAR) => new Date(Date.UTC(Number(year) || DEFAULT_JOINED_YEAR, 0, 1));

export function initializePatrolHistory(member) {
  if (member.patrolHistory?.length) return member.patrolHistory;
  member.patrolHistory = [{ patrol: member.patrol, fromDate: joinedYearStart(member.joinedYear), toDate: null }];
  return member.patrolHistory;
}

export function applyPatrolTransition(member, nextPatrol, at = new Date()) {
  const history = initializePatrolHistory(member);
  if (!nextPatrol || nextPatrol === member.patrol) return false;
  const active = [...history].reverse().find((entry) => !entry.toDate);
  if (active) active.toDate = at;
  history.push({ patrol: nextPatrol, fromDate: at, toDate: null });
  return true;
}

export function updateInitialPatrolStart(member, joinedYear) {
  const history = initializePatrolHistory(member);
  if (history.length === 1 && !history[0].toDate) history[0].fromDate = joinedYearStart(joinedYear);
}

export async function backfillMemberMetadata() {
  const members = await Member.find({
    $or: [
      { hijriDateOfBirth: { $exists: false } },
      { hijriDateOfBirth: "" },
      { hijriCalendarVersion: { $ne: BOHRA_CALENDAR_VERSION } },
      { patrolHistory: { $exists: false } },
      { patrolHistory: { $size: 0 } },
    ],
  }).select("dateOfBirth hijriDateOfBirth hijriCalendarVersion joinedYear patrol patrolHistory");
  if (!members.length) return { matched: 0, modified: 0 };
  const operations = members.map((member) => {
    const set = {};
    if (!member.hijriDateOfBirth || member.hijriCalendarVersion !== BOHRA_CALENDAR_VERSION) set.hijriDateOfBirth = gregorianToHijri(member.dateOfBirth);
    if (member.hijriCalendarVersion !== BOHRA_CALENDAR_VERSION) set.hijriCalendarVersion = BOHRA_CALENDAR_VERSION;
    if (!member.patrolHistory?.length) set.patrolHistory = [{ patrol: member.patrol, fromDate: joinedYearStart(member.joinedYear), toDate: null }];
    return { updateOne: { filter: { _id: member._id }, update: { $set: set } } };
  });
  const result = await Member.bulkWrite(operations);
  return { matched: result.matchedCount, modified: result.modifiedCount };
}

export function formatPatrolHistory(history = []) {
  const format = (value) => new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  return history.map((entry) => `${entry.patrol}: ${format(entry.fromDate)} to ${entry.toDate ? format(entry.toDate) : "Present"}`).join("; ");
}
