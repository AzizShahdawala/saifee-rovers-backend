import Member from "../models/Member.js";
import CelebrationEmailLog from "../models/CelebrationEmailLog.js";
import { sendAnniversaryWish, sendBirthdayWish, sendWarasWish } from "./emailService.js";
import { createAdminNotification, createMemberNotification } from "./notificationService.js";
import { gregorianToHijri, hijriParts } from "../utils/hijriDate.js";

const indianDateParts = (date = new Date()) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
const realEmail = (email) => email && !email.endsWith("@saifeerovers.local");
const sameGregorianDay = (date, month, day) => date && new Date(date).getUTCMonth() + 1 === Number(month) && new Date(date).getUTCDate() === Number(day);

async function loggedEmail({ dateKey, kind, personKey, recipient, send }) {
  if (!realEmail(recipient)) return "no-email";
  try {
    const log = await CelebrationEmailLog.create({ dateKey, kind, personKey, recipient });
    try { const result = await send(); log.messageId = result.messageId; await log.save(); return "sent"; }
    catch (error) { await CelebrationEmailLog.deleteOne({ _id: log._id }); throw error; }
  } catch (error) { if (error.code === 11000) return "already-sent"; throw error; }
}

async function notifyOccasion({ member, kind, dateKey, personKey, title, message, memberLink, adminLink, metadata = {} }) {
  await Promise.all([
    createMemberNotification(member._id, { type: kind, title, message, link: memberLink, dedupeKey: `${kind}:${dateKey}:${personKey}:member`, metadata }),
    createAdminNotification({ type: kind, title, message: `${member.name}'s family: ${message}`, link: adminLink, dedupeKey: `${kind}:${dateKey}:${personKey}:admin`, metadata: { ...metadata, memberId: member._id } }),
  ]);
}

export async function sendTodaysCelebrations(now = new Date()) {
  const { year, month, day } = indianDateParts(now);
  const dateKey = `${year}-${month}-${day}`;
  const bohraToday = hijriParts(gregorianToHijri(`${dateKey}T00:00:00.000Z`));
  const members = await Member.find({ status: "active" }).select("name email patrol dateOfBirth hijriDateOfBirth maritalStatus spouseName spouseDateOfBirth marriageDate children");
  const results = [];
  for (const member of members) {
    const people = [
      { key: `${member._id}:member`, name: member.name, date: member.dateOfBirth, hijriDate: member.hijriDateOfBirth || gregorianToHijri(member.dateOfBirth), relationship: "Member" },
      ...(member.maritalStatus === "MARRIED" && member.spouseName ? [{ key: `${member._id}:spouse`, name: member.spouseName, date: member.spouseDateOfBirth, hijriDate: gregorianToHijri(member.spouseDateOfBirth), relationship: `Spouse of ${member.name}` }] : []),
      ...(member.children || []).map((child) => ({ key: `${member._id}:child:${child._id}`, name: child.name, date: child.dateOfBirth, hijriDate: gregorianToHijri(child.dateOfBirth), relationship: `Child of ${member.name}` })),
    ];
    for (const person of people) {
      if (sameGregorianDay(person.date, month, day)) {
        const message = `Happy Birthday to ${person.name}!`;
        await notifyOccasion({ member, kind: "birthday", dateKey, personKey: person.key, title: "Birthday today", message, memberLink: "/member/birthdays", adminLink: "/birthdays", metadata: { person: person.name } });
        const status = await loggedEmail({ dateKey, kind: "birthday", personKey: person.key, recipient: member.email, send: () => sendBirthdayWish({ email: member.email, recipientName: member.name, celebrantName: person.name, relationship: person.relationship, patrol: member.patrol }) });
        results.push({ kind: "birthday", person: person.name, status });
      }
      const personHijri = hijriParts(person.hijriDate);
      if (personHijri?.month === bohraToday.month && personHijri.day === bohraToday.day) {
        const message = `Waras Mubarak to ${person.name} — ${bohraToday.day} ${bohraToday.monthName}.`;
        await notifyOccasion({ member, kind: "waras", dateKey, personKey: person.key, title: "Waras today", message, memberLink: "/member/waras", adminLink: "/waras", metadata: { person: person.name, hijriDate: person.hijriDate } });
        const status = await loggedEmail({ dateKey, kind: "waras", personKey: person.key, recipient: member.email, send: () => sendWarasWish({ email: member.email, recipientName: member.name, celebrantName: person.name, relationship: person.relationship, patrol: member.patrol, hijriDate: `${bohraToday.day} ${bohraToday.monthName} ${bohraToday.year}H` }) });
        results.push({ kind: "waras", person: person.name, status });
      }
    }
    if (member.maritalStatus === "MARRIED" && sameGregorianDay(member.marriageDate, month, day)) {
      const years = Number(year) - new Date(member.marriageDate).getUTCFullYear();
      const coupleName = `${member.name} & ${member.spouseName}`;
      const personKey = `${member._id}:anniversary`;
      const message = `Happy ${years} anniversary to ${coupleName}!`;
      await notifyOccasion({ member, kind: "anniversary", dateKey, personKey, title: "Anniversary today", message, memberLink: "/member/anniversaries", adminLink: "/anniversaries", metadata: { years } });
      const status = await loggedEmail({ dateKey, kind: "anniversary", personKey, recipient: member.email, send: () => sendAnniversaryWish({ email: member.email, recipientName: member.name, coupleName, years }) });
      results.push({ kind: "anniversary", person: coupleName, status });
    }
  }
  return { dateKey, bohraDate: bohraToday.canonical, matched: results.length, sent: results.filter((item) => item.status === "sent").length, skipped: results.filter((item) => item.status !== "sent").length };
}

export const sendTodaysBirthdayWishes = sendTodaysCelebrations;
