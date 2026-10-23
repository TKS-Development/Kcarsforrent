import type { Metadata } from "next";
import Link from "next/link";

import { formatMoney, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Rental policies",
  description: `Rental terms for ${site.name} — eligibility, payment, pick-up, damage and cancellations.`,
};

/**
 * ⚠️ OWNER: THIS IS A STARTING POINT, NOT LEGAL ADVICE.
 *
 * These clauses are written to be reasonable and readable, but rental terms are
 * jurisdiction-specific and they form part of your contract with the customer.
 * Have someone qualified review this before you rely on it, and make sure it
 * matches your actual insurance policy.
 */
const SECTIONS = [
  {
    title: "Who can rent",
    items: [
      `Drivers must be at least ${site.minimumAge} years old.`,
      "A valid, unexpired driver's licence held for at least 12 months is required, and must be presented in person at pick-up.",
      "Additional drivers must be named on the booking and meet the same requirements.",
      "We may decline a rental at our discretion, including where a licence cannot be verified.",
    ],
  },
  {
    title: "Bookings and confirmation",
    items: [
      "Submitting the booking form creates a request, not a confirmed rental.",
      `A request holds your dates for ${site.deposit.holdHours} hours. Send the ${formatMoney(site.deposit.amount)} booking deposit within that time to lock them in; if it doesn't arrive, the dates are released.`,
      "We confirm your booking by email once the deposit is received.",
      "Prices shown on the site are estimates based on the dates and options you select, and are confirmed in writing when we accept the booking.",
    ],
  },
  {
    title: "Payment",
    items: [
      `A ${formatMoney(site.deposit.amount)} booking deposit, paid by Venmo or Zelle, is required to confirm a booking. It is applied toward your rental total.`,
      "The remaining balance is payable before the keys are handed over. The daily rate is the full price — no added fees and no security deposit.",
    ],
  },
  {
    title: "Using the vehicle",
    items: [
      "The vehicle may only be driven by the named driver(s) on the rental agreement.",
      "No smoking, vaping or open flames inside the vehicle. A cleaning charge applies if this is breached.",
      "The vehicle must not be used for racing, towing, off-road driving, driving instruction, or any commercial passenger service.",
      "Do not operate the vehicle under the influence of alcohol, drugs or any substance that impairs driving.",
      "Return the vehicle with the same fuel level it left with, or a refuelling charge applies.",
    ],
  },
  {
    title: "Themes, wraps and decoration",
    items: [
      "Our vehicles carry custom wraps, paint and props. Please treat them as part of the vehicle.",
      "Removable decorations you bring yourself — ribbon, magnets, non-adhesive signage — are welcome.",
      "Adhesive tape, glue, staples and anything that marks the wrap are not permitted without prior written agreement.",
      "Damage to a wrap or themed element is charged at the cost of repair or replacement.",
    ],
  },
  {
    title: "Pick-up and return",
    items: [
      "The vehicle is collected and returned in person at the agreed time and place.",
      "The named driver must be present with the physical licence used to make the booking.",
      "If you're running late or need to change the time, message us as early as you can and we'll do our best to accommodate it.",
    ],
  },
  {
    title: "Damage, breakdown and accidents",
    items: [
      "The renter is responsible for the vehicle for the duration of the rental, including damage, theft and traffic or parking penalties incurred during that period.",
      "Report any accident, breakdown or damage to us immediately, and to the police where the law requires it.",
      "Do not authorise repairs without our written agreement.",
    ],
  },
  {
    title: "Cancellations and changes",
    items: [
      "Cancelling a request before you've sent the deposit costs nothing.",
      `Cancel or change a confirmed booking at least ${site.deposit.refundNoticeHours} hours before pick-up and we'll move your deposit to a new date.`,
      `Cancellations with less than ${site.deposit.refundNoticeHours} hours' notice, and no-shows, forfeit the deposit.`,
      "If we have to cancel on you, your deposit is refunded in full.",
    ],
  },
  {
    title: "Privacy",
    items: [
      "We collect only what we need to handle your booking: your name, email, phone number, dates and any notes you send us.",
      "We use it to confirm and service your rental, and we don't sell it or share it with third parties for marketing.",
      "Send us a message from the contact page to ask what we hold about you, or to have it deleted.",
    ],
  },
];

export default function PoliciesPage() {
  return (
    <>
      <section className="border-b border-line bg-paper-2 bg-dots py-14">
        <div className="container-page">
          <p className="eyebrow">The fine print</p>
          <h1 className="mt-4 max-w-2xl font-display text-5xl font-extrabold sm:text-6xl">
            Rental policies
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Written to be read, not to be skipped. If anything here is unclear,
            ask us before you book.
          </p>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="mx-auto max-w-3xl space-y-12">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="font-display text-2xl font-extrabold">
                {section.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 leading-relaxed text-ink-2"
                  >
                    <span
                      aria-hidden
                      className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <p className="border-t border-line pt-8 text-sm text-muted">
            Questions about any of this?{" "}
            <Link href="/contact" className="font-bold text-brand underline">
              Send us a message
            </Link>{" "}
            and we’ll answer before you book.
          </p>
        </div>
      </section>
    </>
  );
}
