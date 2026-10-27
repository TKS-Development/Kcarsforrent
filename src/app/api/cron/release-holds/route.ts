import { NextResponse } from "next/server";

import { customerHoldReleased } from "@/emails/templates";
import { getAllBookings, saveBooking } from "@/lib/bookings";
import { needsReleaseNotice } from "@/lib/deposit";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Emails customers whose unpaid hold has lapsed.
 *
 * A hold lapses on its own — availability simply stops counting it — but
 * nothing happens at the moment it does, so the customer was never told.
 * The scheduled function in netlify/functions calls this every 15 minutes.
 *
 * Deliberately unauthenticated: it only emails people whose hold genuinely
 * lapsed, each of them once, so calling it early or often changes nothing.
 */
export async function POST() {
  const bookings = (await getAllBookings()).filter((b) => needsReleaseNotice(b));

  const results = [];
  for (const booking of bookings) {
    const result = await sendEmail(
      booking.customer.email,
      customerHoldReleased(booking),
    );
    if (result.ok) {
      await saveBooking({
        ...booking,
        releaseNotifiedAt: new Date().toISOString(),
      });
    } else {
      // Left unmarked so the next run retries it.
      console.error(
        `[release-holds] ${booking.reference} release email failed:`,
        result.error,
      );
    }
    results.push({ reference: booking.reference, emailed: result.ok });
  }

  return NextResponse.json({ checked: bookings.length, results });
}
