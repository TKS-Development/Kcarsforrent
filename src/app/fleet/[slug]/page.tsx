import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CarCard, CarPhoto } from "@/components/CarCard";
import { carDisplayName, getActiveCars, getCarBySlug } from "@/lib/fleet";
import { PERFECT_FOR } from "@/lib/occasions";
import { formatMoney, site } from "@/lib/site";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const car = await getCarBySlug(slug);
  if (!car) return { title: "Car not found" };

  return {
    title: carDisplayName(car),
    description: car.tagline || car.description.slice(0, 155),
    openGraph: {
      title: carDisplayName(car),
      description: car.tagline,
      images: car.image ? [car.image] : undefined,
    },
  };
}

export default async function CarPage({ params }: PageProps) {
  const { slug } = await params;
  const car = await getCarBySlug(slug);
  if (!car || !car.active) notFound();

  const others = (await getActiveCars())
    .filter((c) => c.id !== car.id)
    .slice(0, 3);

  const hasWeekendRate =
    car.weekendRate !== undefined && car.weekendRate !== car.dailyRate;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: carDisplayName(car),
    description: car.description,
    brand: { "@type": "Brand", name: site.name },
    offers: {
      "@type": "Offer",
      price: car.dailyRate,
      priceCurrency: site.currency,
      availability: "https://schema.org/InStock",
      url: `${site.url}/fleet/${car.slug}`,
    },
  };

  return (
    <>
      <div className="container-page pt-8">
        <Link
          href="/fleet"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition-colors hover:text-brand"
        >
          <span aria-hidden>←</span> Back to the fleet
        </Link>
      </div>

      <article className="container-page grid gap-12 py-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <div
            className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] border-[1.5px] border-line"
            style={{ backgroundColor: `${car.accent}1a` }}
          >
            <CarPhoto car={car} priority />
          </div>

          {car.gallery.length > 0 && (
            <ul className="mt-4 grid grid-cols-3 gap-3">
              {car.gallery.slice(0, 3).map((src) => (
                <li
                  key={src}
                  className="relative aspect-square overflow-hidden rounded-xl border-[1.5px] border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${car.name} detail`}
                    className="h-full w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <span
            className="inline-block rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider text-white"
            style={{ backgroundColor: car.accent }}
          >
            {car.theme}
          </span>

          <h1 className="mt-5 font-display text-5xl font-extrabold sm:text-6xl">
            {car.name}
          </h1>
          <p className="mt-3 text-xl leading-snug text-ink-2">{car.tagline}</p>

          <p className="mt-7 leading-relaxed text-ink-2">{car.description}</p>

          <h2 className="mt-10 font-display text-xl font-extrabold">
            Perfect for
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {PERFECT_FOR.map((occasion) => (
              <li
                key={occasion.title}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-3.5 py-2 text-sm font-bold"
              >
                <span aria-hidden>{occasion.emoji}</span>
                {occasion.title}
              </li>
            ))}
          </ul>

          {car.features.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-xl font-extrabold">
                Your rental includes
              </h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {car.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-ink-2"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full text-[10px] font-black text-white"
                      style={{ backgroundColor: car.accent }}
                    >
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Pricing panel */}
          <div className="card mt-10 p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                  {/* "Weekday rate" only means something next to a weekend
                      one. On a flat rate it implies a premium that isn't
                      charged. */}
                  {hasWeekendRate ? "Weekday rate" : "Daily rate"}
                </p>
                <p className="mt-1 font-display text-4xl font-extrabold">
                  {formatMoney(car.dailyRate)}
                  <span className="ml-1.5 text-base font-semibold text-muted">
                    / day
                  </span>
                </p>
              </div>
              {hasWeekendRate && car.weekendRate && (
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    Fri – Sun
                  </p>
                  <p className="mt-1 font-display text-2xl font-extrabold">
                    {formatMoney(car.weekendRate)}
                    <span className="ml-1 text-sm font-semibold text-muted">
                      / day
                    </span>
                  </p>
                </div>
              )}
            </div>

            <ul className="mt-5 space-y-1.5 border-t border-line pt-5 text-sm text-muted">
              <li className="flex justify-between gap-4">
                <span>Cleaning &amp; prep</span>
                <span className="font-semibold text-ink-2">Included</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Security deposit</span>
                <span className="font-semibold text-ink-2">None</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Booking deposit</span>
                <span className="font-semibold text-ink-2">
                  {formatMoney(site.deposit.amount)}, off your total
                </span>
              </li>
            </ul>

            <Link
              href={`/book?car=${car.slug}`}
              className="btn btn-primary mt-7 w-full py-4 text-base"
            >
              Request these dates
            </Link>
            <p className="mt-3 text-center text-xs text-muted">
              {formatMoney(site.deposit.amount)} deposit holds your date · Rest due at pick-up
            </p>
          </div>
        </div>
      </article>

      {others.length > 0 && (
        <section className="border-t border-line bg-paper-2 py-16">
          <div className="container-page">
            <h2 className="font-display text-3xl font-extrabold">
              Not quite the vibe?
            </h2>
            <div className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((other) => (
                <CarCard key={other.id} car={other} />
              ))}
            </div>
          </div>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
    </>
  );
}
