import Member from "../models/Member.js";
import CelebrationEmailLog from "../models/CelebrationEmailLog.js";
import { sendBirthdayWish } from "./emailService.js";

const indianDateParts = (date = new Date()) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
}).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

export async function sendTodaysBirthdayWishes(now = new Date()) {
  const { year, month, day } = indianDateParts(now);
  const dateKey = `${year}-${month}-${day}`;
  const members = await Member.find({ status: "active", email: { $exists: true, $ne: "" } }).select("name email patrol dateOfBirth maritalStatus spouseName spouseDateOfBirth children");
  const wishes = [];
  for (const member of members) {
    const people = [
      { key: `${member._id}:member`, name: member.name, date: member.dateOfBirth, relationship: "Member" },
      ...(member.maritalStatus === "MARRIED" && member.spouseName ? [{ key: `${member._id}:spouse`, name: member.spouseName, date: member.spouseDateOfBirth, relationship: `Spouse of ${member.name}` }] : []),
      ...(member.children || []).map((child) => ({ key: `${member._id}:child:${child._id}`, name: child.name, date: child.dateOfBirth, relationship: `Child of ${member.name}` })),
    ];
    for (const person of people) {
      if (!person.date || member.email.endsWith("@saifeerovers.local")) continue;
      const birthDate = new Date(person.date);
      if (birthDate.getUTCMonth() + 1 !== Number(month) || birthDate.getUTCDate() !== Number(day)) continue;
      try {
        const log = await CelebrationEmailLog.create({ dateKey, kind: "birthday", personKey: person.key, recipient: member.email });
        try {
          const result = await sendBirthdayWish({ email: member.email, recipientName: member.name, celebrantName: person.name, relationship: person.relationship, patrol: member.patrol });
          log.messageId = result.messageId;
          await log.save();
          wishes.push({ person: person.name, recipient: member.email, sent: true });
        } catch (error) {
          await CelebrationEmailLog.deleteOne({ _id: log._id });
          throw error;
        }
      } catch (error) {
        if (error.code === 11000) wishes.push({ person: person.name, recipient: member.email, sent: false, reason: "already-sent" });
        else throw error;
      }
    }
  }
  return { dateKey, matched: wishes.length, sent: wishes.filter((item) => item.sent).length, skipped: wishes.filter((item) => !item.sent).length };
}
