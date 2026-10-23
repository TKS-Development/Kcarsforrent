export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed";

export const BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "declined",
  "cancelled",
  "completed",
];

/** Statuses that hold a car off the calendar. */
export const BLOCKING_STATUSES: BookingStatus[] = ["pending", "confirmed"];

export interface Car {
  id: string;
  slug: string;
  name: string;
  /** The theme this car is wrapped/decorated as, e.g. "Strawberry Shortcake". */
  theme: string;
  tagline: string;
  description: string;
  /** Real-world model, e.g. "1995 Suzuki Every". */
  model: string;
  seats: number;
  transmission: "Automatic" | "Manual";
  /** Primary image. Either /fleet/foo.jpg (in public/) or a full https URL. */
  image: string;
  gallery: string[];
  /** Accent colour used for the card + detail page, any CSS colour. */
  accent: string;
  features: string[];
  dailyRate: number;
  /** Optional Fri/Sat/Sun rate. Falls back to dailyRate when unset. */
  weekendRate?: number;
  minDays: number;
  /** Inactive cars stay in the database but are hidden from the public site. */
  active: boolean;
  sortOrder: number;
}

export interface BookingCustomer {
  name: string;
  email: string;
  phone: string;
}

/** Outcome of one automated email, recorded so it's visible after the fact. */
export type EmailOutcome = "sent" | "failed" | "not-configured";

export interface EmailDelivery {
  customer: EmailOutcome;
  owner: EmailOutcome;
  /** Provider error, kept for the dashboard so failures are diagnosable. */
  error?: string;
  /** When the send was attempted. */
  attemptedAt: string;
}

export interface Booking {
  id: string;
  /** Human-friendly reference shown to the customer, e.g. "KC-8F3A2B". */
  reference: string;
  carId: string;
  /** Denormalised so the record still reads correctly if a car is renamed. */
  carName: string;
  customer: BookingCustomer;
  /** ISO date, YYYY-MM-DD. */
  startDate: string;
  /** ISO date, YYYY-MM-DD. Inclusive — the car is unavailable on this day. */
  endDate: string;
  pickupTime: string;
  dropoffTime: string;
  occasion: string;
  notes: string;
  status: BookingStatus;
  /** Estimated total at time of request, in whole currency units. */
  quote: Quote;
  /** Internal note the owner can add from the dashboard. */
  ownerNote: string;
  /**
   * When an unpaid request stops holding its dates. Absent on requests taken
   * before deposits existed — those customers were never asked for one, so
   * their holds don't lapse.
   */
  depositDueBy?: string;
  /** When the owner marked the deposit as received. */
  depositReceivedAt?: string;
  /**
   * Whether the confirmation emails actually went out. Absent on bookings
   * taken before this was recorded.
   */
  emailDelivery?: EmailDelivery;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  days: number;
  lines: QuoteLine[];
  total: number;
}

/** A manual date range where a car cannot be booked (maintenance, private use). */
export interface Blackout {
  id: string;
  /** null means it applies to every car. */
  carId: string | null;
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: string;
}
