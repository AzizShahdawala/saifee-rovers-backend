const HIJRI_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|30)$/;

export function isValidHijriDate(value) {
  const match = HIJRI_PATTERN.exec(String(value || "").trim());
  if (!match) return false;
  const year = Number(match[1]);
  return year >= 1200 && year <= 1600;
}

export function gregorianToHijri(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function hijriParts(value) {
  const canonical = gregorianToHijri(value);
  if (!canonical) return null;
  const [year, month, day] = canonical.split("-").map(Number);
  return { year, month, day, canonical };
}

export function hijriToGregorian(year, month, day) {
  const approximateGregorianYear = Math.floor((Number(year) * 354.367) / 365.2425) + 622;
  const cursor = new Date(Date.UTC(approximateGregorianYear - 1, 0, 1));
  for (let index = 0; index < 1100; index += 1) {
    const parts = hijriParts(cursor);
    if (parts?.year === Number(year) && parts.month === Number(month) && parts.day === Number(day)) return new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}

export const HIJRI_DATE_VALIDATION_MESSAGE = "Hijri date of birth must use YYYY-MM-DD (Umm al-Qura calendar)";
