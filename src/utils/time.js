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

module.exports = {
  toMinutes,
  toTimeString,
  rangesOverlap,
  isValidDateString,
  todayDateString,
};
