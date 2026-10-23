import Image from "next/image";
import Link from "next/link";

import { CarCard } from "@/components/CarCard";
import { FeaturedCar } from "@/components/FeaturedCar";
import { KeiVan } from "@/components/KeiVan";
import { carDisplayName, getActiveCars } from "@/lib/fleet";
import { PERFECT_FOR } from "@/lib/occasions";
import { formatMoney, site } from "@/lib/site";

export const dynamic = "force-dynamic";


export default async function HomePage() {
  const cars = await getActiveCars();
  const featured = cars.slice(0, 3);
  const fromPrice = cars.length
    ? Math.min(...cars.map((car) => car.dailyRate))
    : 0;

  // With a single car, "1 car in the fleet" is a weak thing to lead with — show
  // that car's own specs instead.
  const soloCar = cars.length === 1 ? cars[0] : null;
  const heroCar = soloCar ?? featured[0] ?? null;

  const stats = soloCar
    ? [
        // Flat rate, so no "from". Vehicle specs deliberately aren't advertised
        // here — people book this car for how it looks, not its seat count.
        { label: "Daily rate", value: formatMoney(soloCar.dailyRate) },
        { label: "Confirmation", value: "Within 24 hrs" },
      ]
    : [
        { label: "Cars in the fleet", value: String(cars.length) },
        {
          label: "Daily rates from",
          value: fromPrice ? formatMoney(fromPrice) : "—",
        },
        { label: "Confirmation", value: "Within 24 hrs" },
      ];

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-line bg-paper-2 bg-dots">
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            {/* Just the city here. The full service-area string wraps to two
                lines at this size and strands the bullet on its own. Delivery
                is already called out in the stats below. */}
            <p className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Themed Kei cars · {site.city}, {site.region}
            </p>

            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
              Rent the vibe.
              <br />
              <span className="text-brand">Drive the adventure.</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">
              {soloCar
                ? "A one-of-a-kind themed Japanese micro van, built for the occasions worth remembering. Small in size — enormous in character."
                : "A one-of-a-kind fleet of themed Japanese micro vans, built for the occasions worth remembering. Small in size — enormous in character."}
            </p>

            {/* One car, one action. A "see the fleet" button would send people
                to a page showing the same car that's already featured below. */}
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/book" className="btn btn-primary px-7 py-4 text-base">
                Book a car
              </Link>
            </div>

            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-extrabold">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Show the actual car when there's a photo of it — no illustration
              competes with the real thing. Falls back to the drawn van so a
              brand-new car without a photo still gets a hero. */}
          <div className="relative hidden lg:block">
            {heroCar?.image ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border-[1.5px] border-line bg-white shadow-xl">
                <Image
                  src={heroCar.image}
                  alt={carDisplayName(heroCar)}
                  fill
                  priority
                  sizes="(max-width: 1024px) 0px, 50vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <>
                <div
                  aria-hidden
                  className="absolute inset-0 -translate-y-6 rounded-[3rem] bg-brand/8"
                />
                <KeiVan
                  accent={heroCar?.accent ?? "#d6206a"}
                  title="A themed Kei micro van"
                  className="relative w-full animate-float drop-shadow-xl"
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- About */}
      <section className="container-page py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <p className="eyebrow">About us</p>
            <h2 className="mt-4 font-display text-4xl font-extrabold sm:text-5xl">
              Small cars.
              <br />
              Big character.
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-relaxed text-ink-2">
            <p>
              Our mission is to build a one-of-a-kind fleet of themed Kei cars and
              make them accessible to our community at competitive rates, for
              experiences people actually remember.
            </p>
            <p>
              Kei cars are compact Japanese vehicles designed to maximise
              efficiency, personality and fun — small in size, big in character.
              We transform these iconic cars into immersive, themed rides that
              spark joy, turn heads and create lasting memories.
            </p>
            <p>
              From birthday parties and quinceañeras to weekend adventures, photo
              shoots, special events and “just because” moments, our goal is to
              bring excitement, creativity and affordability together — so
              everyone can enjoy something truly unique.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- Fleet */}
      <section className="border-y border-line bg-paper-2 py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">{soloCar ? "The car" : "The fleet"}</p>
              <h2 className="mt-4 font-display text-4xl font-extrabold sm:text-5xl">
                {/* The name itself, not "Meet {name}" — that read as "Meet
                    Hello Kitty Kei Van" once the car stopped having a
                    nickname. */}
                {soloCar ? soloCar.name : "Pick your character"}
              </h2>
            </div>
            {!soloCar && cars.length > 0 && (
              <Link href="/fleet" className="btn btn-ghost bg-white">
                See all {cars.length} cars
              </Link>
            )}
          </div>

          {soloCar ? (
            <div className="mt-12">
              <FeaturedCar car={soloCar} />
            </div>
          ) : featured.length > 0 ? (
            <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((car, i) => (
                <CarCard key={car.id} car={car} priority={i === 0} />
              ))}
            </div>
          ) : (
            <p className="mt-12 text-muted">
              The fleet is being updated — check back shortly.
            </p>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- Occasions */}
      {/* Plain background: the fleet section above is already a tinted band, and
          two in a row read as one long slab with a stray divider through it. */}
      <section className="py-20">
        <div className="container-page">
          <p className="eyebrow">Perfect for</p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl font-extrabold sm:text-5xl">
            What are we celebrating?
          </h2>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERFECT_FOR.map((occasion) => (
              <li
                key={occasion.title}
                className="card flex items-start gap-4 p-6"
              >
                <span aria-hidden className="text-3xl leading-none">
                  {occasion.emoji}
                </span>
                <div>
                  <h3 className="font-display text-lg font-extrabold">
                    {occasion.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {occasion.copy}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------------- Final CTA */}
      <section className="container-page py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink px-8 py-16 text-center text-white sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/25 blur-3xl"
          />
          {/* Blue rather than yellow: warm yellow over the plum-black ground
              muddies into brown. Pink + blue is the Hello Kitty pairing. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-sky/25 blur-3xl"
          />

          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold sm:text-5xl">
              Your occasion deserves a better car
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/70">
              Tell us the date and the vibe. A{" "}
              {formatMoney(site.deposit.amount)} deposit locks it in, and it
              comes off your total.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/book" className="btn btn-primary px-7 py-4 text-base">
                Request a booking
              </Link>
              <Link
                href="/contact"
                className="btn px-7 py-4 text-base border-[1.5px] border-white/25 text-white hover:border-white"
              >
                Ask a question
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
