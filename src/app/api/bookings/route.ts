import { NextResponse } from "next/server";

import {
  customerRequestReceived,
  ownerNewRequest,
} from "@/emails/templates";
import {
  checkAvailability,
  findOwnPendingRequest,
  newBookingId,
  newReference,
  saveBooking,
} from "@/lib/bookings";
import { newDepositDueBy } from "@/lib/deposit";
import { ownerRecipients, sendEmail, type SendResult } from "@/lib/email";
import { carDisplayName, getCarById } from "@/lib/fleet";
import { rentalDays, todayISO } from "@/lib/dates";
import { buildQuote } from "@/lib/pricing";
import type { Booking, EmailDelivery, EmailOutcome } from "@/lib/types";
import { bookingRequestSchema, fieldErrors } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function outcomeOf(result: SendResult): EmailOutcome {
  if (result.ok) return "sent";
  // `skipped` means no API key — a configuration gap, not a delivery failure,
  // and worth distinguishing because the fix is completely different.
  return result.skipped ? "not-configured" : "failed";
}

/**
 * Anything thrown below — a Blobs read that fails, a storage write that
 * doesn't land — would otherwise escape as Next's HTML error page. The browser
 * then fails to parse it as JSON and the customer gets a blank "we couldn't
 * submit that", with the real cause visible nowhere. Catching it here keeps
 * the response shape the form understands and puts the actual error in the
 * function log, which is the only place it can be diagnosed from.
 */
export async function POST(request: Request) {
  try {
    return await handleBooking(request);
  } catch (err) {
    console.error("[bookings] Unhandled failure:", err);
    return NextResponse.json(
      {
        message:
          "Something went wrong on our end and your request wasn't saved. Please try again in a moment — and if it still won't go through, send us a message from the contact page and we'll book you in by hand.",
      },
      { status: 500 },
    );
  }
}

async function handleBooking(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Malformed request." },
      { status: 400 },
    );
  }

  const parsed = bookingRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Please check the highlighted fields.",
        errors: fieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const input = parsed.data;

  // Honeypot: a filled hidden field means a bot. Return a plausible success so
  // it doesn't learn to work around the check — but store nothing and send
  // nothing.
  if (input.website) {
    return NextResponse.json({ reference: newReference() }, { status: 201 });
  }

  if (input.startDate < todayISO()) {
    return NextResponse.json(
      {
        message: "Please check the highlighted fields.",
        errors: { startDate: "Pick-up can't be in the past." },
      },
      { status: 422 },
    );
  }

  const car = await getCarById(input.carId);
  if (!car || !car.active) {
    return NextResponse.json(
      {
        message: "That car isn't available.",
        errors: { carId: "Please choose a car from the list." },
      },
      { status: 422 },
    );
  }

  if (rentalDays(input.startDate, input.endDate) < car.minDays) {
    return NextResponse.json(
      {
        message: "Please check the highlighted fields.",
        errors: {
          endDate: `The ${car.name} has a ${car.minDays}-day minimum rental.`,
        },
      },
      { status: 422 },
    );
  }

  // Authoritative availability check. The browser checks too, but only this one
  // counts — the dates could have been taken while the form was open.
  const availability = await checkAvailability(
    car.id,
    input.startDate,
    input.endDate,
  );
  if (!availability.available) {
    // Before refusing, check whether the thing blocking these dates is this
    // customer's own request. If so they've simply submitted twice, and the
    // right answer is the reference they already have — not an error telling
    // them the dates they just booked are unavailable.
    const own = await findOwnPendingRequest(
      car.id,
      input.email,
      input.startDate,
      input.endDate,
    );
    if (own) {
      return NextResponse.json(
        {
          reference: own.reference,
          status: own.status,
          emailed: {
            customer: own.emailDelivery?.customer === "sent",
            owner: own.emailDelivery?.owner === "sent",
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        message: availability.reason ?? "Those dates are no longer available.",
        errors: {
          startDate: availability.reason ?? "No longer available.",
        },
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const booking: Booking = {
    id: newBookingId(),
    reference: newReference(),
    carId: car.id,
    carName: carDisplayName(car),
    customer: {
      name: input.name,
      email: input.email,
      phone: input.phone,
    },
    startDate: input.startDate,
    endDate: input.endDate,
    pickupTime: input.pickupTime,
    dropoffTime: input.dropoffTime,
    occasion: input.occasion,
    notes: input.notes,
    status: "pending",
    quote: buildQuote({
      car,
      startDate: input.startDate,
      endDate: input.endDate,
    }),
    ownerNote: "",
    depositDueBy: newDepositDueBy(),
    createdAt: now,
    updatedAt: now,
  };

  // Persist first. If email delivery fails the booking still exists in the
  // dashboard, which is far better than losing it because a mail API blipped.
  await saveBooking(booking);

  const [customerResult, ownerResult] = await Promise.all([
    sendEmail(booking.customer.email, customerRequestReceived(booking)),
    sendEmail(ownerRecipients(), ownerNewRequest(booking), {
      replyTo: booking.customer.email,
    }),
  ]);

  if (!customerResult.ok) {
    console.error(
      `[bookings] ${booking.reference} saved but the customer email failed:`,
      customerResult.error,
    );
  }
  if (!ownerResult.ok) {
    console.error(
      `[bookings] ${booking.reference} saved but the owner email failed:`,
      ownerResult.error,
    );
  }

  // Record the outcome on the booking. Previously this only went to the
  // console and the HTTP response, so once the request was over there was no
  // way to tell from the dashboard whether a booking had actually been
  // emailed — the exact question the owner needs answered.
  const emailDelivery: EmailDelivery = {
    customer: outcomeOf(customerResult),
    owner: outcomeOf(ownerResult),
    error: customerResult.error ?? ownerResult.error,
    attemptedAt: new Date().toISOString(),
  };
  await saveBooking({ ...booking, emailDelivery });

  return NextResponse.json(
    {
      reference: booking.reference,
      status: booking.status,
      emailed: {
        customer: customerResult.ok,
        owner: ownerResult.ok,
      },
    },
    { status: 201 },
  );
}
