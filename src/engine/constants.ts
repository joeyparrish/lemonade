import type { Coefficients } from "./types";

export const STARTING_CASH_CENTS = 100; // $1.00
export const STARTING_COST_CENTS = 2; // $0.02
export const MAX_GLASSES_PER_DAY = 60000;
export const MAX_PRICE_CENTS = 20000; // $200.00
export const RUN_LENGTH_DAYS = 30;

/** News events stop firing once cost reaches this, so cost plateaus. */
export const COST_EVENT_CEILING_CENTS = 12; // $0.12

/** Lower inclusive edges. The last band is open ended. */
export const TEMPERATURE_BAND_EDGES = [70, 80, 90, 96] as const;

export interface PriceBand {
  /** Matches when price > aboveCents && price <= throughCents. */
  aboveCents: number;
  throughCents: number;
  coefficients: Coefficients;
}

/**
 * Base demand by price band and temperature band, in hundredths.
 *
 * Note the deliberate gap: the fifth band ends at 125 and the sixth begins
 * above 126, so a price of exactly 126 cents matches nothing and leaves the
 * previous day's coefficients in place. The ladder also skips a rung there,
 * stepping from 40/50/60/70 straight to 20/30/40/50. Both are faithful to the
 * original. See docs/recovered-model.md.
 */
export const PRICE_BANDS: readonly PriceBand[] = [
  { aboveCents: -1, throughCents: 12, coefficients: [80, 90, 100, 100] },
  { aboveCents: 12, throughCents: 25, coefficients: [70, 80, 90, 100] },
  { aboveCents: 25, throughCents: 50, coefficients: [60, 70, 80, 90] },
  { aboveCents: 50, throughCents: 75, coefficients: [50, 60, 70, 80] },
  { aboveCents: 75, throughCents: 125, coefficients: [40, 50, 60, 70] },
  { aboveCents: 126, throughCents: 150, coefficients: [20, 30, 40, 50] },
  { aboveCents: 150, throughCents: 200, coefficients: [10, 20, 30, 40] },
  { aboveCents: 200, throughCents: MAX_PRICE_CENTS, coefficients: [0, 0, 0, 0] },
];
