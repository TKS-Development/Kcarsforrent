"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatDateShort, todayISO } from "@/lib/dates";
import { blocksDates } from "@/lib/deposit";
import type { Blackout, Booking, Car } from "@/lib/types";

export function BlackoutManager({
  cars,
  blackouts,
  bookings,
}: {
  cars: Car[];
  blackouts: Blackout[];
  bookings: Booking[];
}) {
  const router = useRouter();
  const today = todayISO();

  const [carId, setCarId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const carName = useMemo(() => {
    const map = new Map(cars.map((car) => [car.id, car.name]));
    return (id: string | null) => (id === null ? "Every car" : map.get(id) ?? "Unknown car");
  }, [cars]);

  // Confirmed and pending bookings block dates too — showing them here means
  // the owner sees one complete picture of what's unavailable and why.
  const held = bookings
    .filter((b) => blocksDates(b) && b.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const upcomingBlackouts = [...blackouts]
    .filter((b) => b.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const response = await fetch("/api/admin/blackouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, startDate, endDate, reason }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrors(data.errors ?? { form: data.message ?? "Couldn't save." });
        setSaving(false);
        return;
      }

      setStartDate("");
      setEndDate("");
      setReason("");
      router.refresh();
    } catch {
      setErrors({ form: "Couldn't reach the server." });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/blackouts?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">Blocked dates</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Block out maintenance, private use or holidays. Blocked dates can’t be
        requested on the website — customers see the car as unavailable.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[24rem_1fr]">
        <form onSubmit={add} className="card h-fit p-6">
          <h2 className="font-display text-xl font-extrabold">Block some dates</h2>

          {errors.form && (
            <p
              role="alert"
              className="mt-4 rounded-xl border-[1.5px] border-brand bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark"
            >
              {errors.form}
            </p>
          )}

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="field-label">Car</span>
              <select
                className="field-input"
                value={carId}
                onChange={(e) => setCarId(e.target.value)}
              >
                <option value="">Every car</option>
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="field-label">From</span>
              <input
                type="date"
                className="field-input"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              {errors.startDate && (
                <span className="field-error block">{errors.startDate}</span>
              )}
            </label>

            <label className="block">
              <span className="field-label">To</span>
              <input
                type="date"
                className="field-input"
                value={endDate}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
              {errors.endDate && (
                <span className="field-error block">{errors.endDate}</span>
              )}
            </label>

            <label className="block">
              <span className="field-label">Reason</span>
              <input
                type="text"
                className="field-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Servicing, private hire, holiday…"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary mt-6 w-full py-3.5"
          >
            {saving ? "Saving…" : "Block these dates"}
          </button>
        </form>

        <div className="space-y-10">
          <section>
            <h2 className="font-display text-xl font-extrabold">
              Blocked ({upcomingBlackouts.length})
            </h2>
            {upcomingBlackouts.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Nothing blocked. Every car is bookable on any free date.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {upcomingBlackouts.map((blackout) => (
                  <li
                    key={blackout.id}
                    className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-4"
                  >
                    <div className="min-w-40 flex-1">
                      <p className="font-bold">{carName(blackout.carId)}</p>
                      {blackout.reason && (
                        <p className="text-sm text-muted">{blackout.reason}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold">
                      {formatDateShort(blackout.startDate)} –{" "}
                      {formatDateShort(blackout.endDate)}
                    </p>
                    <button
                      type="button"
                      onClick={() => remove(blackout.id)}
                      className="text-sm font-bold text-muted transition-colors hover:text-brand"
                    >
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl font-extrabold">
              Also held by bookings ({held.length})
            </h2>
            <p className="mt-2 text-sm text-muted">
              Pending and confirmed bookings hold their dates automatically.
              Decline or cancel one from the Bookings page to free the dates up.
            </p>
            {held.length > 0 && (
              <ul className="mt-4 space-y-3">
                {held.map((booking) => (
                  <li
                    key={booking.id}
                    className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-4"
                  >
                    <div className="min-w-40 flex-1">
                      <p className="font-bold">{booking.carName}</p>
                      <p className="text-sm text-muted">
                        {booking.customer.name} · {booking.status}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatDateShort(booking.startDate)} –{" "}
                      {formatDateShort(booking.endDate)}
                    </p>
                    <span className="font-mono text-xs text-muted">
                      {booking.reference}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
