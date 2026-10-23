import { formatDateLong, formatDateTime, formatTime } from "@/lib/dates";
import { balanceDue, paymentMethods } from "@/lib/deposit";
import { formatMoney, site } from "@/lib/site";
import type { Booking } from "@/lib/types";

import {
  button,
  callout,
  detailTable,
  emailLayout,
  escapeHtml,
  quoteTable,
} from "./layout";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function bookingRows(booking: Booking) {
  const rows = [
    { label: "Reference", value: `<code>${escapeHtml(booking.reference)}</code>` },
    { label: "Vehicle", value: escapeHtml(booking.carName) },
    {
      label: "Pick-up",
      value: `${escapeHtml(formatDateLong(booking.startDate))} at ${escapeHtml(formatTime(booking.pickupTime))}`,
    },
    {
      label: "Drop-off",
      value: `${escapeHtml(formatDateLong(booking.endDate))} at ${escapeHtml(formatTime(booking.dropoffTime))}`,
    },
    {
      label: "Duration",
      value: `${booking.quote.days} ${booking.quote.days === 1 ? "day" : "days"}`,
    },
  ];

  if (booking.occasion) {
    rows.push({ label: "Occasion", value: escapeHtml(booking.occasion) });
  }

  return rows;
}

function quoteBlock(booking: Booking) {
  return quoteTable(
    booking.quote.lines.map((line) => ({
      label: line.label,
      amount: formatMoney(line.amount),
    })),
    formatMoney(booking.quote.total),
  );
}

const deposit = () => formatMoney(site.deposit.amount);

/** Deadline wording, for requests that have one. */
function dueBy(booking: Booking): string {
  return booking.depositDueBy
    ? formatDateTime(booking.depositDueBy)
    : `within ${site.deposit.holdHours} hours`;
}

/** How to pay the deposit, as HTML. */
function depositInstructions(booking: Booking): string {
  const methods = paymentMethods();
  const list = methods.length
    ? detailTable(
        methods.map((m) => ({
          label: m.label,
          value: m.url
            ? `<a href="${escapeHtml(m.url)}" style="color:#d6206a;">${escapeHtml(m.value)}</a>`
            : escapeHtml(m.value),
        })),
      )
    : `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a343e;">We'll text you how to send it.</p>`;

  return `
    ${callout(`<strong>Your dates are held until ${escapeHtml(dueBy(booking))}.</strong> Send the ${deposit()} deposit by then to lock them in — otherwise they're released for someone else.`, "warn")}
    <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">Send your ${deposit()} deposit</h2>
    ${list}
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a343e;">
      Put <strong>${escapeHtml(booking.reference)}</strong> in the payment note so we can match it to your booking. The deposit goes toward your total — the remaining ${formatMoney(balanceDue(booking.quote.total))} is due at pick-up.
    </p>`;
}

function depositInstructionsText(booking: Booking): string {
  const methods = paymentMethods();
  const lines = methods.length
    ? methods.map((m) => `  ${m.label}: ${m.value}`).join("\n")
    : "  We'll text you how to send it.";
  return `YOUR DATES ARE HELD UNTIL ${dueBy(booking).toUpperCase()}.
Send the ${deposit()} deposit by then to lock them in — otherwise they're released for someone else.

${lines}

Put ${booking.reference} in the payment note so we can match it to your booking. The deposit goes toward your total — the remaining ${formatMoney(balanceDue(booking.quote.total))} is due at pick-up.`;
}

function plainSummary(booking: Booking): string {
  return [
    `Reference: ${booking.reference}`,
    `Vehicle: ${booking.carName}`,
    `Pick-up: ${formatDateLong(booking.startDate)} at ${formatTime(booking.pickupTime)}`,
    `Drop-off: ${formatDateLong(booking.endDate)} at ${formatTime(booking.dropoffTime)}`,
    `Duration: ${booking.quote.days} day(s)`,
    booking.occasion ? `Occasion: ${booking.occasion}` : null,
    `Estimated total: ${formatMoney(booking.quote.total)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Sent to the customer the moment they submit. Sets the "pending" expectation. */
export function customerRequestReceived(booking: Booking): RenderedEmail {
  const html = emailLayout({
    preheader: `We've got your request for the ${booking.carName} — reference ${booking.reference}.`,
    heading: `Thanks, ${booking.customer.name.split(" ")[0]} — we've got your request`,
    intro: `Your request for the <strong>${escapeHtml(booking.carName)}</strong> is in. One step left: send the ${deposit()} deposit and we'll confirm your booking by email.`,
    body: `
      ${depositInstructions(booking)}
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">Your reservation summary</h2>
      ${detailTable(bookingRows(booking))}
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">Estimated cost</h2>
      ${quoteBlock(booking)}
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#7c6069;">
        The daily rate is the full price — no added fees and no security
        deposit. Cancel at least ${site.deposit.refundNoticeHours} hours ahead
        and we'll move your booking deposit to a new date.
      </p>
    `,
    footerNote: `Need to change something? Just reply to this email and quote <strong>${escapeHtml(booking.reference)}</strong>.`,
  });

  const text = `Thanks, ${booking.customer.name.split(" ")[0]} — we've got your request.

Your request for the ${booking.carName} is in. One step left: send the ${deposit()} deposit and we'll confirm your booking by email.

${depositInstructionsText(booking)}

${plainSummary(booking)}

The daily rate is the full price — no added fees and no security deposit. Cancel at least ${site.deposit.refundNoticeHours} hours ahead and we'll move your booking deposit to a new date.

Need to change something? Just reply to this email and quote ${booking.reference}.

${site.name} — ${site.url}`;

  return {
    subject: `Send your deposit to lock in the ${booking.carName} (${booking.reference})`,
    html,
    text,
  };
}

/** Sent to the owner. Front-loads everything needed to make a decision. */
export function ownerNewRequest(booking: Booking): RenderedEmail {
  const html = emailLayout({
    preheader: `${booking.customer.name} wants the ${booking.carName} on ${formatDateLong(booking.startDate)}.`,
    heading: "New booking request",
    intro: `<strong>${escapeHtml(booking.customer.name)}</strong> has requested the <strong>${escapeHtml(booking.carName)}</strong>. They've been asked to send the ${deposit()} deposit with <strong>${escapeHtml(booking.reference)}</strong> in the note. The dates are held until ${escapeHtml(dueBy(booking))} — once the deposit arrives, mark it received in the dashboard to confirm. If it doesn't, the dates free up on their own.`,
    body: `
      ${button({ label: "Open the dashboard", url: `${site.url}/admin/bookings` })}
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">Customer</h2>
      ${detailTable([
        { label: "Name", value: escapeHtml(booking.customer.name) },
        {
          label: "Email",
          value: `<a href="mailto:${escapeHtml(booking.customer.email)}" style="color:#d6206a;">${escapeHtml(booking.customer.email)}</a>`,
        },
        {
          label: "Phone",
          value: `<a href="tel:${escapeHtml(booking.customer.phone.replace(/[^\d+]/g, ""))}" style="color:#d6206a;">${escapeHtml(booking.customer.phone)}</a>`,
        },
      ])}
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">Booking</h2>
      ${detailTable(bookingRows(booking))}
      ${
        booking.notes
          ? `<h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">Their notes</h2>
             <p style="margin:0 0 24px;padding:14px 16px;background:#fff7fa;border:1px solid #f5d9e6;border-radius:12px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(booking.notes)}</p>`
          : ""
      }
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">Quoted</h2>
      ${quoteBlock(booking)}
    `,
  });

  const text = `NEW BOOKING REQUEST

${booking.customer.name} has requested the ${booking.carName}. They've been asked to send the ${deposit()} deposit with ${booking.reference} in the note. Dates are held until ${dueBy(booking)} — if the deposit doesn't arrive, they free up on their own.

Customer
  Name:  ${booking.customer.name}
  Email: ${booking.customer.email}
  Phone: ${booking.customer.phone}

${plainSummary(booking)}
${booking.notes ? `\nTheir notes:\n${booking.notes}\n` : ""}
Mark the deposit received: ${site.url}/admin/bookings`;

  return {
    subject: `New request: ${booking.carName}, ${formatDateLong(booking.startDate)} — ${booking.customer.name}`,
    html,
    text,
  };
}

/** Sent when the owner confirms. */
export function customerConfirmed(booking: Booking): RenderedEmail {
  const html = emailLayout({
    preheader: `Confirmed — the ${booking.carName} is yours on ${formatDateLong(booking.startDate)}.`,
    heading: "You're confirmed. The car is yours.",
    intro: `Good news, ${escapeHtml(booking.customer.name.split(" ")[0])} — your booking for the <strong>${escapeHtml(booking.carName)}</strong> is confirmed and the dates are locked in.`,
    body: `
      ${callout("<strong>Confirmed.</strong> Keep this email — you'll need your reference at pick-up.", "good")}
      ${detailTable(bookingRows(booking))}
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">Cost</h2>
      ${quoteBlock(booking)}
      ${
        booking.depositReceivedAt
          ? detailTable([
              { label: "Deposit paid", value: deposit() },
              {
                label: "Due at pick-up",
                value: `<strong>${formatMoney(balanceDue(booking.quote.total))}</strong>`,
              },
            ])
          : ""
      }
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">What to bring</h2>
      <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#4a343e;">
        <li>A valid driver's licence (minimum age ${site.minimumAge})</li>
        <li>A payment card for the balance</li>
        <li>Proof of insurance, if you're using your own</li>
      </ul>
      ${
        booking.ownerNote
          ? `<h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">A note from us</h2>
             <p style="margin:0 0 24px;padding:14px 16px;background:#fff7fa;border:1px solid #f5d9e6;border-radius:12px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(booking.ownerNote)}</p>`
          : ""
      }
    `,
    footerNote: `Plans changed? Let us know at least 48 hours ahead and quote <strong>${escapeHtml(booking.reference)}</strong>.`,
  });

  const text = `YOU'RE CONFIRMED

Your booking for the ${booking.carName} is confirmed.

${plainSummary(booking)}
${booking.depositReceivedAt ? `Deposit paid: ${deposit()}\nDue at pick-up: ${formatMoney(balanceDue(booking.quote.total))}\n` : ""}
What to bring:
  - A valid driver's licence (minimum age ${site.minimumAge})
  - A payment card for the balance
  - Proof of insurance, if you're using your own
${booking.ownerNote ? `\nA note from us:\n${booking.ownerNote}\n` : ""}
Plans changed? Let us know at least 48 hours ahead and quote ${booking.reference}.

${site.name} — ${site.url}`;

  return {
    subject: `Confirmed: ${booking.carName} on ${formatDateLong(booking.startDate)} (${booking.reference})`,
    html,
    text,
  };
}

/** Sent when the owner declines or cancels. */
export function customerStatusChanged(booking: Booking): RenderedEmail {
  const declined = booking.status === "declined";
  const heading = declined
    ? "We couldn't take this booking"
    : "Your booking has been cancelled";

  // Once a deposit has been paid, "nothing has been charged" is no longer true.
  const moneyLine = booking.depositReceivedAt
    ? `We'll be in touch about your ${deposit()} deposit.`
    : "Nothing has been charged.";

  const intro = declined
    ? `Sorry, ${escapeHtml(booking.customer.name.split(" ")[0])} — we aren't able to take your request for the <strong>${escapeHtml(booking.carName)}</strong> on those dates. ${moneyLine}`
    : `Your booking for the <strong>${escapeHtml(booking.carName)}</strong> has been cancelled. ${moneyLine}`;

  const html = emailLayout({
    preheader: `${heading} — ${booking.reference}`,
    heading,
    intro,
    body: `
      ${detailTable(bookingRows(booking))}
      ${
        booking.ownerNote
          ? `<h2 style="margin:0 0 12px;font-size:16px;font-weight:700;">A note from us</h2>
             <p style="margin:0 0 24px;padding:14px 16px;background:#fff7fa;border:1px solid #f5d9e6;border-radius:12px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(booking.ownerNote)}</p>`
          : ""
      }
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a343e;">
        We'd still love to get you out in one of ours — other cars and other dates may well be open.
      </p>
      ${button({ label: "Check other dates", url: `${site.url}/fleet` })}
    `,
  });

  const text = `${heading.toUpperCase()}

${declined ? `We aren't able to take your request for the ${booking.carName} on those dates.` : `Your booking for the ${booking.carName} has been cancelled.`} ${moneyLine}

${plainSummary(booking)}
${booking.ownerNote ? `\nA note from us:\n${booking.ownerNote}\n` : ""}
Other cars and other dates may well be open: ${site.url}/fleet

${site.name} — ${site.url}`;

  return { subject: `${heading} — ${booking.reference}`, html, text };
}

/** Contact form relay to the owner. */
export function contactMessage(input: {
  name: string;
  email: string;
  phone: string;
  message: string;
}): RenderedEmail {
  const html = emailLayout({
    preheader: `${input.name} sent a message from the website.`,
    heading: "New website enquiry",
    intro: `<strong>${escapeHtml(input.name)}</strong> sent a message through the contact form.`,
    body: `
      ${detailTable([
        { label: "Name", value: escapeHtml(input.name) },
        {
          label: "Email",
          value: `<a href="mailto:${escapeHtml(input.email)}" style="color:#d6206a;">${escapeHtml(input.email)}</a>`,
        },
        { label: "Phone", value: escapeHtml(input.phone || "—") },
      ])}
      <p style="margin:0;padding:14px 16px;background:#fff7fa;border:1px solid #f5d9e6;border-radius:12px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(input.message)}</p>
    `,
  });

  const text = `NEW WEBSITE ENQUIRY

Name:  ${input.name}
Email: ${input.email}
Phone: ${input.phone || "—"}

${input.message}`;

  return { subject: `Website enquiry from ${input.name}`, html, text };
}

/**
 * One-click check that email is actually working.
 *
 * Sent from the dashboard so the owner can verify the API key, the from
 * address and the recipient without having to fake a booking first.
 */
export function testEmail(): RenderedEmail {
  const html = emailLayout({
    preheader: "Your booking emails are working.",
    heading: "Email is working",
    intro:
      "If this landed in your inbox, your Resend key, sending address and notification address are all set up correctly. Booking confirmations will go out the same way.",
    body: `
      ${callout("<strong>Nothing else to do.</strong> This was a test — no booking was created.", "good")}
      ${detailTable([
        {
          label: "Sent from",
          value: escapeHtml(
            process.env.BOOKING_FROM_EMAIL ?? "Resend default address",
          ),
        },
        {
          label: "Sent to",
          value: escapeHtml(process.env.OWNER_NOTIFICATION_EMAIL ?? "—"),
        },
        { label: "Sent at", value: escapeHtml(new Date().toUTCString()) },
      ])}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#7c6069;">
        If this arrived in spam rather than your inbox, your domain's SPF, DKIM
        and DMARC records probably aren't verified in Resend yet.
      </p>
    `,
  });

  const text = `EMAIL IS WORKING

If this landed in your inbox, your Resend key, sending address and notification address are all set up correctly. Booking confirmations will go out the same way.

This was a test — no booking was created.

Sent from: ${process.env.BOOKING_FROM_EMAIL ?? "Resend default address"}
Sent to:   ${process.env.OWNER_NOTIFICATION_EMAIL ?? "—"}
Sent at:   ${new Date().toUTCString()}

If this arrived in spam, your domain's SPF, DKIM and DMARC records probably aren't verified in Resend yet.

${site.name}`;

  return { subject: "Test — your K Cars booking emails are working", html, text };
}
