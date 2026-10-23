"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatDateShort, formatDateTime, formatTime, todayISO } from "@/lib/dates";
import { EmailStatusPanel } from "@/components/admin/EmailStatusPanel";
import { isHoldExpired } from "@/lib/deposit";
import type { EmailHealth } from "@/lib/email-health";
import { formatMoney, site } from "@/lib/site";
import type { Booking, BookingStatus, EmailDelivery } from "@/lib/types";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-sun/20 text-[#7c5306] border-sun/40",
  confirmed: "bg-mint/20 text-[#0f5c50] border-mint/40",
  declined: "bg-stone-200 text-stone-600 border-stone-300",
  cancelled: "bg-stone-200 text-stone-600 border-stone-300",
  completed: "bg-grape/15 text-[#4c1d95] border-grape/30",
};

/** A lapsed hold is still "pending" in storage but no longer needs a decision. */
type FilterKey = "all" | "expired" | BookingStatus;

function filterKeyOf(booking: Booking): FilterKey {
  return isHoldExpired(booking) ? "expired" : booking.status;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "pending", label: "Needs a decision" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "declined", label: "Declined" },
  { key: "cancelled", label: "Cancelled" },
  { key: "expired", label: "Deposit never came" },
  { key: "all", label: "Everything" },
];

export function BookingsBoard({
  bookings,
  emailHealth,
}: {
  bookings: Booking[];
  emailHealth: EmailHealth;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "good" | "bad"; text: string } | null>(
    null,
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: bookings.length };
    for (const booking of bookings) {
      const key = filterKeyOf(booking);
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }, [bookings]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? bookings
        : bookings.filter((booking) => filterKeyOf(booking) === filter),
    [bookings, filter],
  );

  const today = todayISO();
  const upcomingRevenue = bookings
    .filter((b) => b.status === "confirmed" && b.endDate >= today)
    .reduce((sum, b) => sum + b.quote.total, 0);

  async function changeStatus(
    booking: Booking,
    status: BookingStatus,
    options: { promptNote?: boolean; depositReceived?: boolean } = {},
  ) {
    let ownerNote = booking.ownerNote;

    if (options.promptNote) {
      const entered = window.prompt(
        status === "declined"
          ? "Add a short note for the customer (optional) — it goes in their email."
          : "Add a note for the customer (optional) — it goes in their email.",
        booking.ownerNote,
      );
      // Cancel on the prompt means abort the whole action.
      if (entered === null) return;
      ownerNote = entered;
    }

    setBusyId(booking.id);
    setFlash(null);

    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ownerNote,
          notify: true,
          depositReceived: options.depositReceived ?? false,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFlash({ tone: "bad", text: data.message ?? "That didn't work." });
        setBusyId(null);
        return;
      }

      setFlash({
        tone: "good",
        text:
          data.emailed === false
            ? `Booking updated, but the email to ${booking.customer.email} failed to send. Check your Resend settings.`
            : `Booking ${booking.reference} marked ${status}. The customer has been emailed.`,
      });
      router.refresh();
    } catch {
      setFlash({ tone: "bad", text: "Couldn't reach the server." });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(booking: Booking) {
    if (
      !window.confirm(
        `Permanently delete booking ${booking.reference}? This can't be undone, and the customer is not notified.`,
      )
    ) {
      return;
    }

    setBusyId(booking.id);
    try {
      await fetch(`/api/admin/bookings/${booking.id}`, { method: "DELETE" });
      setFlash({ tone: "good", text: `Deleted ${booking.reference}.` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Bookings</h1>
          <p className="mt-2 text-sm text-muted">
            {counts.pending ?? 0} waiting on you ·{" "}
            {formatMoney(upcomingRevenue)} confirmed and still to come
          </p>
        </div>
      </div>

      <EmailStatusPanel health={emailHealth} />

      {flash && (
        <p
          role="status"
          className={`mt-6 rounded-xl border-[1.5px] px-4 py-3 text-sm font-semibold ${
            flash.tone === "good"
              ? "border-mint bg-mint/10 text-[#0f5c50]"
              : "border-brand bg-brand-light text-brand-dark"
          }`}
        >
          {flash.text}
        </p>
      )}

      <div className="mt-7 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-full border-[1.5px] px-4 py-2 text-sm font-bold transition-colors ${
              filter === option.key
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-ink-2 hover:border-ink/40"
            }`}
          >
            {option.label}
            <span className="ml-2 opacity-60">{counts[option.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card mt-7 p-12 text-center">
          <p className="font-display text-xl font-extrabold">Nothing here</p>
          <p className="mt-2 text-sm text-muted">
            {filter === "pending"
              ? "No bookings are waiting on a decision. Nice."
              : filter === "expired"
                ? "No requests have lapsed without a deposit."
                : "No bookings match this filter yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-7 space-y-4">
          {visible.map((booking) => {
            const busy = busyId === booking.id;
            const past = booking.endDate < today;
            const expired = isHoldExpired(booking);
            const awaitingDeposit =
              booking.status === "pending" &&
              booking.depositDueBy !== undefined &&
              !booking.depositReceivedAt;

            return (
              <li key={booking.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-start gap-x-6 gap-y-4 p-6">
                  <div className="min-w-56 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider ${
                          expired ? STATUS_STYLES.declined : STATUS_STYLES[booking.status]
                        }`}
                      >
                        {expired ? "hold expired" : booking.status}
                      </span>
                      <span className="font-mono text-xs font-bold text-muted">
                        {booking.reference}
                      </span>
                      <EmailBadge delivery={booking.emailDelivery} />
                      {past && booking.status === "confirmed" && (
                        <span className="text-[0.7rem] font-bold uppercase tracking-wider text-muted">
                          · date passed
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3 font-display text-xl font-extrabold">
                      {booking.customer.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted">{booking.carName}</p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <a
                        href={`mailto:${booking.customer.email}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        {booking.customer.email}
                      </a>
                      <a
                        href={`tel:${booking.customer.phone.replace(/[^\d+]/g, "")}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        {booking.customer.phone}
                      </a>
                    </div>
                  </div>

                  <dl className="min-w-56 space-y-1.5 text-sm">
                    <Row
                      label="Pick-up"
                      value={`${formatDateShort(booking.startDate)}, ${formatTime(booking.pickupTime)}`}
                    />
                    <Row
                      label="Drop-off"
                      value={`${formatDateShort(booking.endDate)}, ${formatTime(booking.dropoffTime)}`}
                    />
                    <Row
                      label="Days"
                      value={String(booking.quote.days)}
                    />
                    {booking.occasion && (
                      <Row label="Occasion" value={booking.occasion} />
                    )}
                    <Row
                      label="Quoted"
                      value={formatMoney(booking.quote.total)}
                    />
                    <DepositRow booking={booking} expired={expired} />
                  </dl>
                </div>

                {booking.notes && (
                  <div className="border-t border-line bg-paper-2 px-6 py-4">
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted">
                      Customer notes
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                      {booking.notes}
                    </p>
                  </div>
                )}

                {booking.ownerNote && (
                  <div className="border-t border-line bg-paper-2 px-6 py-4">
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted">
                      Your note to them
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                      {booking.ownerNote}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4">
                  {awaitingDeposit && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        changeStatus(booking, "confirmed", {
                          promptNote: true,
                          depositReceived: true,
                        })
                      }
                      className="btn btn-primary px-5 py-2.5 text-sm"
                    >
                      {busy
                        ? "Working…"
                        : `${formatMoney(site.deposit.amount)} received · Confirm`}
                    </button>
                  )}

                  {booking.status !== "confirmed" && !awaitingDeposit && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        changeStatus(booking, "confirmed", { promptNote: true })
                      }
                      className="btn btn-primary px-5 py-2.5 text-sm"
                    >
                      {busy ? "Working…" : "Confirm & email"}
                    </button>
                  )}

                  {booking.status === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        changeStatus(booking, "declined", { promptNote: true })
                      }
                      className="btn btn-ghost bg-white px-5 py-2.5 text-sm"
                    >
                      Decline
                    </button>
                  )}

                  {booking.status === "confirmed" && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => changeStatus(booking, "completed")}
                        className="btn btn-ghost bg-white px-5 py-2.5 text-sm"
                      >
                        Mark completed
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          changeStatus(booking, "cancelled", { promptNote: true })
                        }
                        className="btn btn-ghost bg-white px-5 py-2.5 text-sm"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(booking)}
                    className="ml-auto text-sm font-bold text-muted transition-colors hover:text-brand"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Whether this booking's confirmation emails actually went out. Bookings taken
 * before delivery was recorded have no data, and say so rather than implying
 * success.
 */
function EmailBadge({ delivery }: { delivery?: EmailDelivery }) {
  if (!delivery) {
    return (
      <span
        title="This booking predates email tracking."
        className="rounded-full border border-stone-300 bg-stone-100 px-2.5 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-stone-500"
      >
        Email · unknown
      </span>
    );
  }

  const bothSent =
    delivery.customer === "sent" && delivery.owner === "sent";

  if (bothSent) {
    return (
      <span className="rounded-full border border-mint/40 bg-mint/20 px-2.5 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-[#0f5c50]">
        Emails sent
      </span>
    );
  }

  const parts: string[] = [];
  if (delivery.customer !== "sent") parts.push("customer");
  if (delivery.owner !== "sent") parts.push("you");
  const notConfigured =
    delivery.customer === "not-configured" ||
    delivery.owner === "not-configured";

  return (
    <span
      title={delivery.error ?? undefined}
      className="rounded-full border border-brand/40 bg-brand-light px-2.5 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-brand-dark"
    >
      {notConfigured ? "Email not configured" : `Email failed → ${parts.join(" + ")}`}
    </span>
  );
}

/**
 * Where this booking's deposit stands. Requests from before deposits existed
 * have no due date and were never asked for one.
 */
function DepositRow({ booking, expired }: { booking: Booking; expired: boolean }) {
  if (booking.depositReceivedAt) {
    return (
      <Row
        label="Deposit"
        value={`${formatMoney(site.deposit.amount)} received`}
      />
    );
  }
  if (!booking.depositDueBy) return null;
  if (expired) {
    return <Row label="Deposit" value="Never came · dates released" />;
  }
  if (booking.status !== "pending") return null;
  return (
    <Row label="Deposit due" value={formatDateTime(booking.depositDueBy)} />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
