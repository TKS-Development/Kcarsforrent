import { NextResponse } from "next/server";
import { z } from "zod";

import { customerConfirmed, customerStatusChanged } from "@/emails/templates";
import {
  checkAvailability,
  deleteBooking,
  getBooking,
  updateBookingStatus,
} from "@/lib/bookings";
import { sendEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/guard";
import { BOOKING_STATUSES } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(BOOKING_STATUSES as [string, ...string[]]),
  ownerNote: z.string().max(2000).optional(),
  /** Set false to change the status without emailing the customer. */
  notify: z.boolean().optional().default(true),
  /** The owner is confirming because the deposit came in. */
  depositReceived: z.boolean().optional().default(false),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Malformed request." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid status update." },
      { status: 422 },
    );
  }

  const { status, ownerNote, notify, depositReceived } = parsed.data;

  const existing = await getBooking(id);
  if (!existing) {
    return NextResponse.json({ message: "Booking not found." }, { status: 404 });
  }

  // Confirming a booking that was released (declined/cancelled) could collide
  // with something taken in the meantime, so re-check before re-blocking it.
  if (status === "confirmed" && existing.status !== "confirmed") {
    const availability = await checkAvailability(
      existing.carId,
      existing.startDate,
      existing.endDate,
      { ignoreBookingId: existing.id },
    );
    if (!availability.available) {
      return NextResponse.json(
        {
          message:
            "Those dates clash with another booking for this car. Resolve the clash first.",
        },
        { status: 409 },
      );
    }
  }

  const updated = await updateBookingStatus(
    id,
    status as (typeof BOOKING_STATUSES)[number],
    ownerNote,
    depositReceived && !existing.depositReceivedAt
      ? { depositReceivedAt: new Date().toISOString() }
      : {},
  );
  if (!updated) {
    return NextResponse.json({ message: "Booking not found." }, { status: 404 });
  }

  let emailed: boolean | null = null;

  if (notify && status !== existing.status) {
    if (status === "confirmed") {
      const result = await sendEmail(
        updated.customer.email,
        customerConfirmed(updated),
      );
      emailed = result.ok;
    } else if (status === "declined" || status === "cancelled") {
      const result = await sendEmail(
        updated.customer.email,
        customerStatusChanged(updated),
      );
      emailed = result.ok;
    }
  }

  return NextResponse.json({ booking: updated, emailed });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await deleteBooking(id);
  return NextResponse.json({ ok: true });
}
