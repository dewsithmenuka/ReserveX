export const APP_TIME_ZONE = "Asia/Colombo"; // UTC+05:30, no DST
const OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function dayBounds(now: Date) {
  const local = new Date(now.getTime() + OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  const start = new Date(local.getTime() - OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}