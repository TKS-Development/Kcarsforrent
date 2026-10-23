"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { addDays, formatTime, rentalDays, todayISO } from "@/lib/dates";
import { OCCASION_OPTIONS } from "@/lib/occasions";
import { buildQuote } from "@/lib/pricing";
import { formatMoney, site } from "@/lib/site";
import type { Car } from "@/lib/types";


const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let hour = 8; hour <= 20; hour += 1) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
    if (hour !== 20) slots.push(`${String(hour).padStart(2, "0")}:30`);
  }
  return slots;
})();

type Errors = Record<string, string>;

interface AvailabilityState {
  status: "idle" | "checking" | "available" | "unavailable";
  reason?: string;
}

export function BookingForm({ cars }: { cars: Car[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = todayISO();

  const preselected = searchParams.get("car");
  const initialCar =
    cars.find((car) => car.slug === preselected)?.id ?? cars[0]?.id ?? "";

  const [carId, setCarId] = useState(initialCar);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pickupTime, setPickupTime] = useState("10:00");
  const [dropoffTime, setDropoffTime] = useState("17:00");
  const [occasion, setOccasion] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [agreed, setAgreed] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityState>({
    status: "idle",
  });

  const car = useMemo(
    () => cars.find((c) => c.id === carId) ?? null,
    [cars, carId],
  );

  // Keep the drop-off date sane: never before pick-up, and default to the
  // car's minimum rental length the first time a pick-up date is chosen.
  useEffect(() => {
    if (!startDate) return;
    if (!endDate || endDate < startDate) {
      const minimum = Math.max(1, car?.minDays ?? 1);
      setEndDate(addDays(startDate, minimum - 1));
    }
  }, [startDate, endDate, car]);

  // Ask the server whether these dates are actually free. Debounced so typing
  // a date with the keyboard doesn't fire a request per keystroke.
  useEffect(() => {
    if (!carId || !startDate || !endDate || endDate < startDate) {
      setAvailability({ status: "idle" });
      return;
    }

    let cancelled = false;
    setAvailability({ status: "checking" });

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ carId, startDate, endDate });
        const response = await fetch(`/api/availability?${params}`);
        const data = await response.json();
        if (cancelled) return;

        setAvailability(
          data.available
            ? { status: "available" }
            : { status: "unavailable", reason: data.reason },
        );
      } catch {
        // A failed check shouldn't block the request — the server re-checks
        // authoritatively on submit anyway.
        if (!cancelled) setAvailability({ status: "idle" });
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [carId, startDate, endDate]);

  const quote = useMemo(() => {
    if (!car || !startDate || !endDate || endDate < startDate) return null;
    return buildQuote({ car, startDate, endDate });
  }, [car, startDate, endDate]);

  const belowMinimum =
    car && startDate && endDate && endDate >= startDate
      ? rentalDays(startDate, endDate) < car.minDays
      : false;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    if (!agreed) {
      setErrors({ agreed: "Please accept the rental terms to continue." });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          name,
          email,
          phone,
          startDate,
          endDate,
          pickupTime,
          dropoffTime,
          occasion,
          notes,
          website,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors(
          data.errors ?? {
            form: data.message ?? "Something went wrong. Please try again.",
          },
        );
        setSubmitting(false);
        // Bring the first problem into view rather than leaving people staring
        // at an unchanged form wondering why nothing happened.
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      router.push(`/book/confirmation?ref=${encodeURIComponent(data.reference)}`);
    } catch {
      setErrors({
        form: "We couldn't submit that — it may have been a connection blip. Please try again, and if it keeps happening send us a message from the contact page.",
      });
      setSubmitting(false);
    }
  }

  if (cars.length === 0) {
    return (
      <div className="card p-10 text-center">
        <h2 className="font-display text-2xl font-extrabold">
          No cars available right now
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Please get in touch and we’ll let you know the moment something opens
          up for your dates.
        </p>
      </div>
    );
  }

  const submitDisabled =
    submitting || availability.status === "unavailable" || belowMinimum;

  // With one car there's nothing to choose, so the picker step is dropped and
  // the remaining steps renumber rather than starting at "2".
  const multiCar = cars.length > 1;
  const step = (n: number) => String(multiCar ? n : n - 1);

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-10">
        {errors.form && (
          <p
            role="alert"
            className="rounded-xl border-[1.5px] border-brand bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark"
          >
            {errors.form}
          </p>
        )}

        {/* ------------------------------------------------------- 1. The car */}
        {multiCar ? (
        <fieldset>
          <Legend step="1" title="Choose your car" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {cars.map((option) => {
              const selected = option.id === carId;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-xl border-[1.5px] p-4 transition-all ${
                    selected
                      ? "border-brand bg-brand-light/50 shadow-sm"
                      : "border-line bg-white hover:border-ink/25"
                  }`}
                >
                  <input
                    type="radio"
                    name="carId"
                    value={option.id}
                    checked={selected}
                    onChange={() => setCarId(option.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className="h-11 w-11 shrink-0 rounded-lg"
                    style={{ backgroundColor: option.accent }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-extrabold">
                      {option.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {option.theme}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-extrabold">
                    {formatMoney(option.dailyRate)}
                  </span>
                </label>
              );
            })}
          </div>
          {errors.carId && <p className="field-error">{errors.carId}</p>}
        </fieldset>
        ) : (
          car && (
            <div
              className="flex items-center gap-4 rounded-xl border-[1.5px] border-line p-5"
              style={{ backgroundColor: `${car.accent}14` }}
            >
              <span
                aria-hidden
                className="h-12 w-12 shrink-0 rounded-xl"
                style={{ backgroundColor: car.accent }}
              />
              <div className="min-w-0">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted">
                  You’re booking
                </p>
                <p className="font-display text-xl font-extrabold">
                  {car.name}
                </p>
                <p className="text-sm text-muted">
                  {car.theme}
                </p>
              </div>
              <p className="ml-auto shrink-0 text-right">
                <span className="font-display text-xl font-extrabold">
                  {formatMoney(car.dailyRate)}
                </span>
                <span className="block text-xs font-semibold text-muted">
                  per day
                </span>
              </p>
            </div>
          )
        )}

        {/* ----------------------------------------------------- 2. The dates */}
        <fieldset>
          <Legend step={step(2)} title="When do you need it?" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Pick-up date" error={errors.startDate} required>
              <input
                type="date"
                className="field-input"
                value={startDate}
                min={today}
                max={addDays(today, 365)}
                onChange={(e) => setStartDate(e.target.value)}
                aria-invalid={Boolean(errors.startDate)}
                required
              />
            </Field>

            <Field label="Pick-up time" error={errors.pickupTime} required>
              <select
                className="field-input"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {formatTime(slot)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Drop-off date" error={errors.endDate} required>
              <input
                type="date"
                className="field-input"
                value={endDate}
                min={startDate || today}
                max={startDate ? addDays(startDate, 30) : addDays(today, 365)}
                onChange={(e) => setEndDate(e.target.value)}
                aria-invalid={Boolean(errors.endDate)}
                required
              />
            </Field>

            <Field label="Drop-off time" error={errors.dropoffTime} required>
              <select
                className="field-input"
                value={dropoffTime}
                onChange={(e) => setDropoffTime(e.target.value)}
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {formatTime(slot)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {belowMinimum && car && (
            <p className="mt-4 rounded-xl border-[1.5px] border-sun bg-sun/10 px-4 py-3 text-sm font-semibold text-ink-2">
              The {car.name} has a {car.minDays}-day minimum. Please extend your
              drop-off date.
            </p>
          )}

          {availability.status === "checking" && (
            <p className="mt-4 text-sm font-semibold text-muted">
              Checking availability…
            </p>
          )}
          {availability.status === "available" && (
            <p className="mt-4 rounded-xl border-[1.5px] border-mint bg-mint/10 px-4 py-3 text-sm font-semibold text-ink-2">
              Good news — {car?.name} is free on those dates.
            </p>
          )}
          {availability.status === "unavailable" && (
            <p
              role="alert"
              className="mt-4 rounded-xl border-[1.5px] border-brand bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark"
            >
              {availability.reason ?? "Those dates aren't available."} Try
              different dates, or pick another car.
            </p>
          )}
        </fieldset>

        {/* -------------------------------------------------- 3. The occasion */}
        <fieldset>
          <Legend step={step(3)} title="Tell us about the occasion" />
          <div className="mt-5 space-y-4">
            <Field label="What's it for?" error={errors.occasion}>
              <select
                className="field-input"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
              >
                <option value="">Select an occasion (optional)</option>
                {OCCASION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Anything else we should know?" error={errors.notes}>
              <textarea
                className="field-input min-h-28 resize-y"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Decorations, timings, where you're headed — anything that helps us prep the car."
              />
            </Field>
          </div>
        </fieldset>

        {/* ---------------------------------------------------- 4. Your details */}
        <fieldset>
          <Legend step={step(4)} title="Your details" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Full name" error={errors.name} required>
                <input
                  type="text"
                  className="field-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  required
                />
              </Field>
            </div>

            <Field label="Email" error={errors.email} required>
              <input
                type="email"
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                aria-invalid={Boolean(errors.email)}
                required
              />
            </Field>

            <Field label="Phone" error={errors.phone} required>
              <input
                type="tel"
                className="field-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
                aria-invalid={Boolean(errors.phone)}
                required
              />
            </Field>
          </div>

          {/* Honeypot — hidden from people, irresistible to bots. */}
          <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
            <label>
              Leave this empty
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4.5 w-4.5 accent-[#d6206a]"
              aria-invalid={Boolean(errors.agreed)}
            />
            <span className="text-sm leading-relaxed text-ink-2">
              I’m {site.minimumAge} or older, hold a valid driver’s licence, and
              I’ve read the{" "}
              <Link
                href="/policies"
                target="_blank"
                rel="noopener"
                className="font-bold text-brand underline"
              >
                rental policies
              </Link>
              .
            </span>
          </label>
          {errors.agreed && <p className="field-error">{errors.agreed}</p>}
        </fieldset>
      </div>

      {/* ------------------------------------------------------------ Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          <div
            className="px-6 py-5"
            style={{ backgroundColor: car ? `${car.accent}1f` : undefined }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
              Your booking
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold">
              {car?.name ?? "Choose a car"}
            </p>
            {car && <p className="text-sm text-muted">{car.theme}</p>}
          </div>

          <div className="p-6">
            {quote ? (
              <>
                <ul className="space-y-2.5 text-sm">
                  {quote.lines.map((line) => (
                    <li key={line.label} className="flex justify-between gap-4">
                      <span className="text-muted">{line.label}</span>
                      <span className="shrink-0 font-semibold">
                        {formatMoney(line.amount)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex items-baseline justify-between border-t-2 border-ink pt-4">
                  <span className="font-display text-base font-extrabold">
                    Estimated total
                  </span>
                  <span className="font-display text-2xl font-extrabold">
                    {formatMoney(quote.total)}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-muted">
                  That’s the full price, no added fees. A{" "}
                  {formatMoney(site.deposit.amount)} deposit holds your date and
                  comes off this total — the rest is due at pick-up.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">
                Pick your dates and we’ll work out the total.
              </p>
            )}

            <button
              type="submit"
              disabled={submitDisabled}
              className="btn btn-primary mt-6 w-full py-4 text-base"
            >
              {submitting ? "Sending…" : "Request this booking"}
            </button>

            <p className="mt-3 text-center text-xs leading-relaxed text-muted">
              Nothing is charged here. Next you’ll get Venmo / Zelle details
              for the {formatMoney(site.deposit.amount)} deposit — your dates
              are held for {site.deposit.holdHours} hours while you send it.
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Legend({ step, title }: { step: string; title: string }) {
  return (
    <legend className="flex w-full items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-extrabold text-white">
        {step}
      </span>
      <span className="font-display text-2xl font-extrabold">{title}</span>
    </legend>
  );
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {required && <span className="ml-1 text-brand">*</span>}
      </span>
      {children}
      {error && <span className="field-error block">{error}</span>}
    </label>
  );
}
