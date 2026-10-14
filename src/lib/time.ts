const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function toColomboInputValue(date: Date): string {
  return new Date(date.getTime() + COLOMBO_OFFSET_MS)
    .toISOString()
    .slice(0, 16);
}

// A datetime-local value represents Sri Lanka local time, regardless of
// the browser's timezone.
export function parseColomboLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}:00+05:30`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // Reject impossible dates such as February 30.
  return toColomboInputValue(date) === value ? date : null;
}

export function formatDateTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(value.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

// Returns the start (inclusive) and end (exclusive) of the
// calendar day in Sri Lanka time.
export function dayBounds(date: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to determine the Colombo calendar date.");
  }

  const start = parseColomboLocal(`${year}-${month}-${day}T00:00`);

  if (!start) {
    throw new Error("Unable to calculate the start of the Colombo day.");
  }

  const nextDay = new Date(`${year}-${month}-${day}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const nextYear = nextDay.getUTCFullYear();
  const nextMonth = String(nextDay.getUTCMonth() + 1).padStart(2, "0");
  const nextDayOfMonth = String(nextDay.getUTCDate()).padStart(2, "0");

  const end = parseColomboLocal(
    `${nextYear}-${nextMonth}-${nextDayOfMonth}T00:00`,
  );

  if (!end) {
    throw new Error("Unable to calculate the end of the Colombo day.");
  }

  return { start, end };
}