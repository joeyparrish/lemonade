import { PRICE_BANDS, TEMPERATURE_BAND_EDGES } from "./constants";
import type { Rng } from "./rng";
import type { Coefficients } from "./types";

const MAX_COEFFICIENT = 100;
const JITTER_MAX_ROLL = 10;
const NO_DEMAND_ABOVE_CENTS = 200;

/**
 * Choose base demand for the day's price.
 *
 * When no band matches, the previous day's coefficients are returned
 * unchanged. That happens at exactly 126 cents, where the original's bands
 * leave a gap, and it is faithful rather than an oversight. See
 * docs/recovered-model.md.
 */
export function selectCoefficients(
  previous: Coefficients,
  priceCents: number,
): Coefficients {
  for (const band of PRICE_BANDS) {
    if (priceCents > band.aboveCents && priceCents <= band.throughCents) {
      return band.coefficients;
    }
  }
  return previous;
}

/**
 * Add the day's random bonus of 1 to 10 hundredths, capped at 1.00.
 *
 * The draw happens whatever the price, but the bonus is discarded above $2.00,
 * which is what makes demand there exactly zero rather than merely small.
 */
export function applyJitter(
  coefficients: Coefficients,
  priceCents: number,
  rng: Rng,
): Coefficients {
  const roll = rng.nextInt(JITTER_MAX_ROLL);
  const jitter = priceCents > NO_DEMAND_ABOVE_CENTS ? 0 : roll;
  const bump = (c: number): number => Math.min(c + jitter, MAX_COEFFICIENT);
  return [
    bump(coefficients[0]),
    bump(coefficients[1]),
    bump(coefficients[2]),
    bump(coefficients[3]),
  ];
}

/** Index into a Coefficients tuple for a temperature. Always 0 to 3. */
export function temperatureBandIndex(temperatureF: number): number {
  let index = 0;
  for (let i = 0; i < TEMPERATURE_BAND_EDGES.length; i++) {
    if (temperatureF >= TEMPERATURE_BAND_EDGES[i]!) index = i;
  }
  return index;
}

/** Glasses actually sold, floored. */
export function glassesSold(
  glassesMade: number,
  coefficientHundredths: number,
): number {
  return Math.floor((glassesMade * coefficientHundredths) / MAX_COEFFICIENT);
}
