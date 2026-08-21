import { COST_EVENT_CEILING_CENTS } from "./constants";
import type { Rng } from "./rng";
import type { NewsEvent } from "./types";

interface EventBand {
  throughRoll: number;
  event: NewsEvent;
  increaseCents: number;
}

/** Roll 1 to 100. Anything above the last band is an ordinary day. */
const EVENT_BANDS: readonly EventBand[] = [
  { throughRoll: 10, event: "sugar", increaseCents: 2 },
  { throughRoll: 20, event: "lemons", increaseCents: 3 },
  { throughRoll: 25, event: "cups", increaseCents: 4 },
];

/**
 * Decide whether the cost of a glass rises today.
 *
 * The original gates the whole check on cost being below $0.12, which is why a
 * long run plateaus instead of becoming unplayable. Cost never falls.
 */
export function rollNewsEvent(
  costPerGlassCents: number,
  rng: Rng,
): { costPerGlassCents: number; event: NewsEvent | null } {
  if (costPerGlassCents >= COST_EVENT_CEILING_CENTS) {
    return { costPerGlassCents, event: null };
  }
  const roll = rng.nextInt(100);
  for (const band of EVENT_BANDS) {
    if (roll <= band.throughRoll) {
      return {
        costPerGlassCents: costPerGlassCents + band.increaseCents,
        event: band.event,
      };
    }
  }
  return { costPerGlassCents, event: null };
}
