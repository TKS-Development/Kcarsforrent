import { randomBytes, randomUUID } from "node:crypto";

import { rangesOverlap } from "./dates";
import { blocksDates } from "./deposit";
import { getStore } from "./store";
import type { Blackout, Booking, BookingStatus } from "./types";

const BOOKING_PREFIX = "bookings/";
const BLACKOUT_KEY = "blackouts";

/**
 * Bookings are stored one blob per booking rather than as a single array.
 * Two customers submitting at the same moment then can't clobber each other's
 * record, which a read-modify-write on one shared document would allow.
 */

export function newBookingId(): string {
  return `bk_${randomUUID()}`;
}

/** Short, unambiguous reference for customers to quote. No 0/O/1/I. */
export function newReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `KC-${out}`;
}

export async function saveBooking(booking: Booking): Promise<Booking> {
  await getStore().set(`${BOOKING_PREFIX}${booking.id}`, booking);
  return booking;
}

export async function getBooking(id: string): Promise<Booking | null> {
  return getStore().get<Booking>(`${BOOKING_PREFIX}${id}`);
}

export async function getBookingByReference(
  reference: string,
): Promise<Booking | null> {
  const all = await getAllBookings();
  const target = reference.trim().toUpperCase();
  return all.find((b) => b.reference.toUpperCase() === target) ?? null;
}

export async function getAllBookings(): Promise<Booking[]> {
  const store = getStore();
  const keys = await store.list(BOOKING_PREFIX);
  const records = await Promise.all(keys.map((key) => store.get<Booking>(key)));
  return records
    .filter((b): b is Booking => b !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
  ownerNote?: string,
  changes: Partial<Pick<Booking, "depositReceivedAt">> = {},
): Promise<Booking | null> {
  const booking = await getBooking(id);
  if (!booking) return null;

  const updated: Booking = {
    ...booking,
    ...changes,
    status,
    ownerNote: ownerNote ?? booking.ownerNote,
    updatedAt: new Date().toISOString(),
  };
  await saveBooking(updated);
  return updated;
}

export async function deleteBooking(id: string): Promise<void> {
  await getStore().remove(`${BOOKING_PREFIX}${id}`);
}

// --- Blackout dates --------------------------------------------------------

export async function getBlackouts(): Promise<Blackout[]> {
  return (await getStore().get<Blackout[]>(BLACKOUT_KEY)) ?? [];
}

export async function addBlackout(
  blackout: Omit<Blackout, "id" | "createdAt">,
): Promise<Blackout> {
  const record: Blackout = {
    ...blackout,
    id: `bo_${randomUUID()}`,
    createdAt: new Date().toISOString(),
  };
  const all = await getBlackouts();
  await getStore().set(BLACKOUT_KEY, [...all, record]);
  return record;
}

export async function deleteBlackout(id: string): Promise<void> {
  const all = await getBlackouts();
  await getStore().set(
    BLACKOUT_KEY,
    all.filter((b) => b.id !== id),
  );
}

// --- Availability ----------------------------------------------------------

export interface AvailabilityResult {
  available: boolean;
  /** Why not, in language safe to show a customer. */
  reason?: string;
}

/**
 * Is this car free for the whole requested range?
 *
 * Blocked by any pending or confirmed booking that overlaps, and by any
 * blackout range covering the car (or all cars). Declined and cancelled
 * bookings release their dates, and so does a pending request whose deposit
 * window lapsed.
 */
export async function checkAvailability(
  carId: string,
  startDate: string,
  endDate: string,
  options: { ignoreBookingId?: string } = {},
): Promise<AvailabilityResult> {
  const [bookings, blackouts] = await Promise.all([
    getAllBookings(),
    getBlackouts(),
  ]);

  const clash = bookings.find(
    (booking) =>
      booking.carId === carId &&
      booking.id !== options.ignoreBookingId &&
      blocksDates(booking) &&
      rangesOverlap(startDate, endDate, booking.startDate, booking.endDate),
  );

  if (clash) {
    return {
      available: false,
      reason: "Those dates are already taken for this car.",
    };
  }

  const blocked = blackouts.find(
    (blackout) =>
      (blackout.carId === null || blackout.carId === carId) &&
      rangesOverlap(startDate, endDate, blackout.startDate, blackout.endDate),
  );

  if (blocked) {
    return {
      available: false,
      reason: "This car is unavailable on those dates.",
    };
  }

  return { available: true };
}

/**
 * The same person's own already-recorded request for exactly these dates.
 *
 * A pending request blocks its own dates, so a customer who submits twice —
 * a double-click, a refresh, or a retry after the first response was slow to
 * come back — collides with themselves and gets told the dates are taken.
 * That reads as the site being broken when in fact their booking went through.
 * Matching on car, dates and email lets the route hand back the reference it
 * already has instead.
 */
export async function findOwnPendingRequest(
  carId: string,
  email: string,
  startDate: string,
  endDate: string,
): Promise<Booking | null> {
  const all = await getAllBookings();
  const target = email.trim().toLowerCase();
  return (
    all.find(
      (booking) =>
        booking.carId === carId &&
        booking.startDate === startDate &&
        booking.endDate === endDate &&
        blocksDates(booking) &&
        booking.status === "pending" &&
        booking.customer.email.trim().toLowerCase() === target,
    ) ?? null
  );
}

/**
 * Every date in the next `days` days on which this car is already spoken for.
 * Used to grey out dates in the booking calendar.
 */
export async function getUnavailableDates(
  carId: string,
): Promise<{ startDate: string; endDate: string }[]> {
  const [bookings, blackouts] = await Promise.all([
    getAllBookings(),
    getBlackouts(),
  ]);

  const ranges = bookings
    .filter(
      (b) => b.carId === carId && blocksDates(b),
    )
    .map((b) => ({ startDate: b.startDate, endDate: b.endDate }));

  const blackoutRanges = blackouts
    .filter((b) => b.carId === null || b.carId === carId)
    .map((b) => ({ startDate: b.startDate, endDate: b.endDate }));

  return [...ranges, ...blackoutRanges];
}
