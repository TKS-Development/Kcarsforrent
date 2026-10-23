export interface OpeningHours {
  days: string;
  time: string;
}

export interface SocialLinks {
  /** Full profile URL, or null if there isn't one yet. */
  instagram: string | null;
  /** Display handle, e.g. "@kcarsforrent". */
  instagramHandle: string | null;
}

export interface DepositConfig {
  /** Booking deposit, in whole currency units. Applied toward the rental total. */
  amount: number;
  /** How long a new request holds its dates before it's released unpaid. */
  holdHours: number;
  /** Venmo username without the @, or null to leave Venmo off. */
  venmo: string | null;
  /** Phone number or email Zelle is registered to, or null to leave Zelle off. */
  zelle: string | null;
  /** Name the customer sees on the Zelle payment, so they know it's the right person. */
  zelleName: string | null;
  /** Cancel at least this far ahead and the deposit moves to a new date. */
  refundNoticeHours: number;
}

export interface SiteConfig {
  name: string;
  legalName: string;
  tagline: string;
  shortDescription: string;
  url: string;
  city: string;
  region: string;
  /** Short label for tight spots — the hero eyebrow and the footer bar. */
  serviceArea: string;
  /**
   * The towns you actually cover, named individually.
   *
   * Naming them is what gets you found for "kei car rental Tulare" and the
   * like — a vague "Central Valley" matches nothing people actually type.
   * These are listed on the contact page and emitted as schema.org areaServed.
   */
  serviceTowns: string[];
  hours: OpeningHours[];
  social: SocialLinks;
  currency: string;
  minimumAge: number;
  deposit: DepositConfig;
}

/**
 * Business details used across the site, emails and structured data.
 *
 * >>> EDIT ME <<<
 * Anything still marked TODO is a placeholder. Everything else is real.
 */
export const site: SiteConfig = {
  name: "K Cars for Rent",
  legalName: "K Cars for Rent",
  tagline: "Rent the vibe. Drive the adventure.",
  shortDescription:
    "Themed Japanese Kei cars and micro vans for birthdays, quinceañeras, photo shoots and any occasion worth showing up for.",

  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kcarsforrent.com",

  // No public phone number or email address by choice — every enquiry comes in
  // through the booking and contact forms. Where those notifications land is a
  // separate, private setting: the OWNER_NOTIFICATION_EMAIL environment
  // variable, which is never rendered on the site. Because the forms are now
  // the only way in, anywhere that used to say "if this fails, call us" points
  // at the contact form instead.

  city: "Visalia",
  region: "CA",
  serviceArea: "Visalia & nearby towns",

  // Trim any of these you don't actually travel to. Claiming a town you won't
  // drive to costs you a wasted enquiry and a disappointed customer.
  serviceTowns: [
    "Visalia",
    "Tulare",
    "Exeter",
    "Farmersville",
    "Goshen",
    "Woodlake",
    "Lindsay",
    "Dinuba",
    "Hanford",
    "Porterville",
  ],

  hours: [
    { days: "Monday – Friday", time: "9:00 AM – 6:00 PM" },
    { days: "Saturday", time: "9:00 AM – 8:00 PM" },
    { days: "Sunday", time: "By appointment" },
  ],

  // No Instagram yet. Fill both fields in and the links reappear in the footer
  // and on the contact page automatically — nothing else needs changing.
  social: {
    instagram: null,
    instagramHandle: null,
  },

  currency: "USD",

  /** Minimum age to rent. Shown on the policies page and the booking form. */
  minimumAge: 21,

  // Every new request holds its dates only until this deposit arrives. Unpaid
  // holds lapse on their own, so a request nobody follows up on can't block
  // the calendar. Payment is by hand (Venmo / Zelle), so the owner marks it
  // received from the dashboard.
  deposit: {
    amount: 50,
    holdHours: 24,
    venmo: "Yuval-De-Medonsa",
    zelle: "480-658-5391",
    zelleName: "Yuval De-Medonsa",
    refundNoticeHours: 48,
  },
};

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: site.currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
