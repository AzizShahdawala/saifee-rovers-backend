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

export const HIJRI_DATE_VALIDATION_MESSAGE = "Hijri date of birth must use YYYY-MM-DD (Umm al-Qura calendar)";
