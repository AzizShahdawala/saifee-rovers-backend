const HIJRI_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|30)$/;
const ANCHOR_GREGORIAN_MS = Date.UTC(2026, 6, 15);
const ANCHOR_YEAR = 1448;
const ANCHOR_DAY_OF_YEAR = 30;
const DAY_MS = 86_400_000;
const LEAP_YEARS = new Set([2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29]);
const MONTH_NAMES = ["Moharram al-Haraam", "Safar al-Muzaffar", "Rabi al-Awwal", "Rabi al-Aakhar", "Jumada al-Ula", "Jumada al-Ukhra", "Rajab al-Asab", "Shabaan al-Kareem", "Ramadan al-Moazzam", "Shawwal al-Mukarram", "Zilqad al-Haraam", "Zilhaj al-Haraam"];

export const BOHRA_CALENDAR_VERSION = "bohra-misri-v1";
export const HIJRI_MONTH_NAMES = MONTH_NAMES;
export const isBohraLeapYear = (year) => LEAP_YEARS.has(((Number(year) - 1) % 30) + 1);
export const daysInHijriMonth = (year, month) => Number(month) === 12 ? (isBohraLeapYear(year) ? 30 : 29) : (Number(month) % 2 === 1 ? 30 : 29);
const yearLength = (year) => isBohraLeapYear(year) ? 355 : 354;
const daysBeforeMonth = (year, month) => {
  let total = 0;
  for (let current = 1; current < Number(month); current += 1) total += daysInHijriMonth(year, current);
  return total;
};
const yearOffset = (year) => {
  let days = 0;
  if (year >= ANCHOR_YEAR) for (let current = ANCHOR_YEAR; current < year; current += 1) days += yearLength(current);
  else for (let current = ANCHOR_YEAR - 1; current >= year; current -= 1) days -= yearLength(current);
  return days;
};
const canonical = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function isValidHijriDate(value) {
  const match = HIJRI_PATTERN.exec(String(value || "").trim());
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  return year >= 1200 && year <= 1600 && day <= daysInHijriMonth(year, month);
}

export function hijriToGregorian(year, month, day) {
  if (!isValidHijriDate(canonical(year, month, day))) return null;
  const offset = yearOffset(Number(year)) + daysBeforeMonth(Number(year), Number(month)) + Number(day) - 1 - ANCHOR_DAY_OF_YEAR;
  return new Date(ANCHOR_GREGORIAN_MS + offset * DAY_MS);
}

export function gregorianToHijri(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const offset = Math.round((utc - ANCHOR_GREGORIAN_MS) / DAY_MS) + ANCHOR_DAY_OF_YEAR;
  let year = ANCHOR_YEAR;
  let dayOfYear = offset;
  while (dayOfYear < 0) { year -= 1; dayOfYear += yearLength(year); }
  while (dayOfYear >= yearLength(year)) { dayOfYear -= yearLength(year); year += 1; }
  let month = 1;
  while (dayOfYear >= daysInHijriMonth(year, month)) { dayOfYear -= daysInHijriMonth(year, month); month += 1; }
  return canonical(year, month, dayOfYear + 1);
}

export function hijriParts(value) {
  const valueString = value instanceof Date || typeof value === "number" ? gregorianToHijri(value) : String(value || "");
  if (!isValidHijriDate(valueString)) return null;
  const [year, month, day] = valueString.split("-").map(Number);
  return { year, month, day, canonical: canonical(year, month, day), monthName: MONTH_NAMES[month - 1] };
}

export const HIJRI_DATE_VALIDATION_MESSAGE = "Hijri date of birth must be a valid Dawoodi Bohra Misri calendar date";
