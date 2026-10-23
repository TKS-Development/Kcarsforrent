import type { Metadata } from "next";
import Link from "next/link";

import { formatDateLong, formatDateTime, formatTime } from "@/lib/dates";
import { getBookingByReference } from "@/lib/bookings";
import { balanceDue, isHoldExpired, paymentMethods } from "@/lib/deposit";
import { formatMoney, site } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking requested",
  // A confirmation page has no business in search results.
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ ref?: string }>;
}

export default async function ConfirmationPage({ searchParams }: PageProps) {
  const { ref } = await searchParams;
  const booking = ref ? await getBookingByReference(ref) : null;

  // Older bookings have no delivery record; assume the email went out rather
  // than alarming someone about a send that probably succeeded.
  const needsDeposit =
    booking !== null &&
    booking.status === "pending" &&
    booking.depositDueBy !== undefined &&
    !isHoldExpired(booking);
  const methods = paymentMethods();

  const emailReachedCustomer =
    booking !== null &&
    (booking.emailDelivery === undefined ||
      booking.emailDelivery.customer === "sent");

  return (
    <section className="container-page py-20">
      <div className="mx-auto max-w-2xl text-center">
        {/* A party popper and "Request received" read as finished. Until the
            deposit is in, the headline has to be the step that's left. */}
        <span
          aria-hidden
          className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-4xl ${
            needsDeposit ? "bg-sun/20" : "bg-mint/15"
          }`}
        >
          {needsDeposit ? "⏳" : "🎉"}
        </span>

        <h1 className="mt-7 font-display text-5xl font-extrabold sm:text-6xl">
          {needsDeposit
            ? `Almost done — send your ${formatMoney(site.deposit.amount)} deposit`
            : "Request received"}
        </h1>

        {/* Only claim the email was sent if it actually was. Saying "we've
            emailed you" after a failed send sends people hunting through spam
            for something that was never delivered. */}
        <p className="mt-5 text-lg leading-relaxed text-ink-2">
          {needsDeposit ? (
            <>
              Your booking <strong>isn’t confirmed yet</strong>. Your dates are
              held until the time below — send the deposit to lock them in.
              {emailReachedCustomer && (
                <> We’ve also emailed these details to {booking.customer.email}.</>
              )}
            </>
          ) : emailReachedCustomer ? (
            <>
              We’ve emailed you a copy at {booking.customer.email}.
            </>
          ) : (
            <>We’ve got your request.</>
          )}
        </p>

        {booking && !emailReachedCustomer && (
          <p className="mx-auto mt-5 max-w-lg rounded-xl border-[1.5px] border-sun bg-sun/10 px-4 py-3 text-sm leading-relaxed text-ink-2">
            We couldn’t send your confirmation email just now, so please save
            your reference below. Your request did reach us — nothing is lost.
          </p>
        )}

        {ref && (
          <p className="mt-8 inline-block rounded-full border-[1.5px] border-line bg-white px-6 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
              Your reference
            </span>
            <span className="ml-3 font-display text-xl font-extrabold tracking-wider">
              {ref}
            </span>
          </p>
        )}
      </div>

      {needsDeposit && booking.depositDueBy && (
        <div className="card mx-auto mt-12 max-w-2xl overflow-hidden border-sun">
          <div className="border-b border-line bg-sun/10 px-7 py-4">
            <h2 className="font-display text-lg font-extrabold">
              Send your {formatMoney(site.deposit.amount)} deposit by{" "}
              {formatDateTime(booking.depositDueBy)}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              If it hasn’t arrived by then, your dates are released for someone
              else.
            </p>
          </div>

          {methods.length > 0 ? (
            <dl className="divide-y divide-line px-7">
              {methods.map((method) => (
                <div
                  key={method.label}
                  className="flex flex-wrap justify-between gap-3 py-4"
                >
                  <dt className="text-sm text-muted">{method.label}</dt>
                  <dd className="text-sm font-bold">
                    {method.url ? (
                      <a
                        href={method.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand underline"
                      >
                        {method.value}
                      </a>
                    ) : (
                      method.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="px-7 py-4 text-sm">
              We’ll text you how to send it.
            </p>
          )}

          <p className="border-t border-line bg-paper-2 px-7 py-4 text-sm leading-relaxed">
            Put <strong className="font-mono">{booking.reference}</strong> in
            the payment note so we can match it to you. We’ll email your
            confirmation once it arrives.
          </p>
        </div>
      )}

      {booking && (
        <div className="card mx-auto mt-12 max-w-2xl overflow-hidden">
          <div className="border-b border-line bg-paper-2 px-7 py-4">
            <h2 className="font-display text-lg font-extrabold">
              Your reservation summary
            </h2>
          </div>

          <dl className="divide-y divide-line px-7">
            {[
              { label: "Car", value: booking.carName },
              {
                label: "Pick-up",
                value: `${formatDateLong(booking.startDate)} at ${formatTime(booking.pickupTime)}`,
              },
              {
                label: "Drop-off",
                value: `${formatDateLong(booking.endDate)} at ${formatTime(booking.dropoffTime)}`,
              },
              {
                label: "Duration",
                value: `${booking.quote.days} ${booking.quote.days === 1 ? "day" : "days"}`,
              },
              ...(booking.occasion
                ? [{ label: "Occasion", value: booking.occasion }]
                : []),
              {
                label: "Estimated total",
                value: formatMoney(booking.quote.total),
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap justify-between gap-3 py-4"
              >
                <dt className="text-sm text-muted">{row.label}</dt>
                <dd className="text-sm font-bold">{row.value}</dd>
              </div>
            ))}
          </dl>

          <p className="border-t border-line bg-paper-2 px-7 py-4 text-xs leading-relaxed text-muted">
            The {formatMoney(site.deposit.amount)} deposit comes off your
            total — the remaining{" "}
            {formatMoney(balanceDue(booking.quote.total))} is due at pick-up.
            Cancel at least {site.deposit.refundNoticeHours} hours ahead and
            we’ll move your deposit to a new date.
          </p>
        </div>
      )}

      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <Link href="/fleet" className="btn btn-ghost">
          Back to the fleet
        </Link>
        <Link href="/contact" className="btn btn-primary">
          Get in touch
        </Link>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        Didn’t get an email? Check your spam folder, or{" "}
        <Link href="/contact" className="font-bold text-brand underline">
          get in touch
        </Link>
        {ref && <> quoting {ref}</>}.
      </p>
    </section>
  );
}
