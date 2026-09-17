const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(value) {
  if (typeof value !== "string") return null;
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function toTimeString(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value.trim()))
    return false;
  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value.trim();
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** Wall-clock date (YYYY-MM-DD) and minutes-from-midnight in `timeZone`. */
function zonedNow(timeZone = process.env.APP_TIMEZONE || DEFAULT_TIMEZONE) {
  const parts = {};
  for (const { type, value } of new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date())) {
    if (type !== "literal") parts[type] = value;
  }
  const hour = Number(parts.hour === "24" ? "0" : parts.hour);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute),
  };
}

module.exports = {
  toMinutes,
  toTimeString,
  rangesOverlap,
  isValidDateString,
  todayDateString,
  zonedNow,
  DEFAULT_TIMEZONE,
};
