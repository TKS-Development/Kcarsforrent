/**
 * Booking deposit rules. Kept free of Node imports — the dashboard and the
 * calendar use these in the browser too.
 */
import { site } from "./site";
import { BLOCKING_STATUSES, type Booking } from "./types";

export function newDepositDueBy(from = new Date()): string {
  return new Date(
    from.getTime() + site.deposit.holdHours * 3_600_000,
  ).toISOString();
}

/** A pending request whose deposit never arrived in time. */
export function isHoldExpired(booking: Booking, now = Date.now()): boolean {
  return (
    booking.status === "pending" &&
    booking.depositDueBy !== undefined &&
    now >= new Date(booking.depositDueBy).getTime()
  );
}

/**
 * Does this booking keep its car off the calendar right now?
 *
 * Pending and confirmed bookings do, except a pending request whose deposit
 * window has lapsed — that releases its dates without anyone having to act.
 */
export function blocksDates(booking: Booking, now = Date.now()): boolean {
  return BLOCKING_STATUSES.includes(booking.status) && !isHoldExpired(booking, now);
}

/** What's left to pay at pick-up once the deposit is in. */
export function balanceDue(total: number): number {
  return Math.max(0, total - site.deposit.amount);
}

export interface PaymentMethod {
  label: string;
  value: string;
  url?: string;
}

/** The ways a customer can send the deposit, from whatever's configured. */
export function paymentMethods(): PaymentMethod[] {
  const { venmo, zelle, zelleName } = site.deposit;
  const methods: PaymentMethod[] = [];
  if (venmo) {
    methods.push({
      label: "Venmo",
      value: `@${venmo}`,
      url: `https://venmo.com/u/${encodeURIComponent(venmo)}`,
    });
  }
  if (zelle) {
    methods.push({
      label: "Zelle",
      value: zelleName ? `${zelle} (${zelleName})` : zelle,
    });
  }
  return methods;
}
