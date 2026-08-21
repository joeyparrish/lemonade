import type { Rng } from "./rng";
import type { Weather } from "./types";

const RAIN_CHANCE_CUTOFF = 70;
const TEMPERATURE_BASE_F = 70;
const TEMPERATURE_SPREAD = 35;

/**
 * Draw the day's weather. Chance of rain first, then temperature, matching the
 * original's draw order.
 *
 * A rain roll of 70 or above means no chance of rain at all, so roughly a
 * third of days are guaranteed dry. The temperature lands in 71 to 105; the
 * original wrapped this in a retry loop rejecting anything below 70, which
 * given the formula can never trigger, so it is not reproduced.
 */
export function generateWeather(rng: Rng): Weather {
  const rainRoll = rng.nextInt(100);
  const chanceOfRain = rainRoll < RAIN_CHANCE_CUTOFF ? rainRoll : 0;
  const temperatureF = TEMPERATURE_BASE_F + rng.nextInt(TEMPERATURE_SPREAD);
  return { temperatureF, chanceOfRain };
}

/** Resolve whether it actually rains. No draw happens when the chance is zero. */
export function resolveRain(chanceOfRain: number, rng: Rng): boolean {
  if (chanceOfRain === 0) return false;
  return rng.nextInt(100) <= chanceOfRain;
}
