import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingForm } from "@/components/BookingForm";
import { getActiveCars } from "@/lib/fleet";
import { formatMoney, site } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a car",
  description: `Request a themed Kei car from ${site.name}. A ${formatMoney(site.deposit.amount)} deposit holds your date.`,
  robots: { index: true, follow: true },
};

export default async function BookPage() {
  const cars = await getActiveCars();

  return (
    <>
      <section className="border-b border-line bg-paper-2 bg-dots py-14">
        <div className="container-page">
          <p className="eyebrow">Booking</p>
          <h1 className="mt-4 max-w-2xl font-display text-5xl font-extrabold sm:text-6xl">
            Let’s get you booked
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            {cars.length === 1
              ? `Tell us when you need it. Send the ${formatMoney(site.deposit.amount)} deposit and we'll lock in your dates and prep the car for your occasion.`
              : `Tell us which car and when. Send the ${formatMoney(site.deposit.amount)} deposit and we'll lock in your dates and prep the car for your occasion.`}
          </p>
        </div>
      </section>

      <section className="container-page py-14">
        <Suspense
          fallback={
            <div className="card p-10 text-center text-muted">
              Loading the booking form…
            </div>
          }
        >
          <BookingForm cars={cars} />
        </Suspense>
      </section>
    </>
  );
}
