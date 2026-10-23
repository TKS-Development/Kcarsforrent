/**
 * Date helpers. Every date in this app is a plain "YYYY-MM-DD" string so that
 * nothing ever shifts by a day due to server timezone — a real hazard for a
 * booking system where the server is UTC and the customer is not.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function toUTC(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today in the given IANA timezone, as YYYY-MM-DD. */
export function todayISO(timeZone = "America/Los_Angeles"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

export function addDays(value: string, days: number): string {
  const date = toUTC(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/**
 * Number of rental days between two inclusive dates.
 * Pickup Fri and return Sun is 3 days — the car is out of service all three.
 */
export function rentalDays(startDate: string, endDate: string): number {
  const ms = toUTC(endDate).getTime() - toUTC(startDate).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

/** Every date from start to end, inclusive. */
export function eachDate(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  let cursor = startDate;
  // Guard against a runaway loop if the range is inverted or absurd.
  for (let i = 0; i < 400 && cursor <= endDate; i += 1) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** Friday, Saturday or Sunday. */
export function isWeekend(value: string): boolean {
  const day = toUTC(value).getUTCDay();
  return day === 5 || day === 6 || day === 0;
}

/**
 * Do two inclusive date ranges touch?
 *
 * Deliberately inclusive on both ends: if one rental returns on the 3rd, the
 * car is not available to a different customer on the 3rd. Themed cars need
 * cleaning and prep between bookings.
 */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function formatDateLong(value: string, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(toUTC(value));
}

export function formatDateShort(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(toUTC(value));
}

/** "2:00 PM" from "14:00". */
export function formatTime(value: string): string {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "Fri, Oct 24, 3:00 PM" for a full timestamp, in the business's timezone. */
export function formatDateTime(
  iso: string,
  timeZone = "America/Los_Angeles",
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
