# Lemonade Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, single player web version of the 1996 BBS door game
Lemonade!, driven by a pure, deterministic TypeScript engine implementing the
simulation recovered from the original binary.

**Architecture:** A pure engine (`src/engine`) with no DOM, clock, or ambient
randomness, exposing `startRun(seed)` and `advanceDay(state, decision)` over
plain serializable data. A thin front end (`src/ui`) renders engine state and
collects decisions. A storage wrapper isolates local storage so that a browser
refusing it degrades to an in memory session.

**Tech Stack:** TypeScript, Vite, Vitest. No UI framework. No runtime
dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-lemonade-web-design.md`

**Model reference:** `docs/recovered-model.md` holds the recovered simulation
with the address each constant came from. Where this plan and that document
disagree, that document is correct and the plan is a bug.

## Global Constraints

- TypeScript strict mode on. No `any` in `src/engine`.
- `src/engine` must not reference `Date`, `Math.random`, `window`, `document`,
  `localStorage`, or `fetch`. Determinism is the point of the module.
- All money is integer **cents**. Never floating point. The original used a
  64 bit integer scaled by 10,000; integer cents is the same idea at the
  precision this game actually uses, since prices are entered in whole cents
  and every cost increment is a whole cent.
- Demand coefficients are integer **hundredths** (80 means 0.80) for the same
  reason. This is a deliberate, documented deviation from the original's single
  precision floats, permitted by the fidelity policy in the spec. It changes
  results only where float rounding would have lost a fraction of a glass.
- Run length is 30 days, as the named constant `RUN_LENGTH_DAYS`.
- Preserve original quirks. Any intentional deviation gets a comment at the
  site explaining what the original did and why this differs.
- No runtime dependencies in `package.json`. Dev dependencies only.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | Project scaffolding |
| `src/engine/rng.ts` | Seeded generator. The only source of randomness. |
| `src/engine/types.ts` | `GameState`, `Decision`, `DayOutcome`, and friends |
| `src/engine/constants.ts` | Recovered constants and the demand table |
| `src/engine/cost.ts` | News events and per glass cost |
| `src/engine/weather.ts` | Temperature, chance of rain, rain outcome |
| `src/engine/demand.ts` | Coefficient selection and glasses sold |
| `src/engine/game.ts` | `startRun`, `advanceDay`, run completion |
| `src/engine/index.ts` | Public surface of the engine |
| `src/storage/store.ts` | Local storage wrapper with in memory fallback |
| `src/ui/format.ts` | Money and number formatting |
| `src/ui/theme.css` | Palette, typography, box borders |
| `src/ui/app.ts` | Screen state machine and wiring |
| `src/ui/screens/*.ts` | Individual screens |
| `test/engine/*.test.ts` | Engine tests, one file per engine module |

---

## Task 1: Scaffolding and the seeded generator

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/engine/rng.ts`
- Test: `test/engine/rng.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createRng(seed: number): Rng` where
  `interface Rng { next(): number; nextInt(maxInclusive: number): number }`.
  `next()` returns a float in `[0, 1)`. `nextInt(n)` returns an integer in
  `[1, n]` and is the direct equivalent of the original's `INT(rnd * n + 1)`.

- [ ] **Step 1: Create the scaffolding**

`package.json`:

```json
{
  "name": "lemonade-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "test"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  test: { globals: true, environment: "node" },
});
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lemonade</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/ui/app.ts"></script>
  </body>
</html>
```

Then run `npm install`.

- [ ] **Step 2: Write the failing test**

`test/engine/rng.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRng } from "../../src/engine/rng";

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it("returns values in [0, 1)", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("nextInt returns integers in [1, n]", () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.nextInt(10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
      seen.add(v);
    }
    expect(seen.size).toBe(10);
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npm test -- rng`
Expected: FAIL, cannot resolve `../../src/engine/rng`.

- [ ] **Step 4: Implement**

`src/engine/rng.ts`:

```ts
/** A seeded, deterministic source of randomness. The engine's only one. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /**
   * Integer in [1, maxInclusive]. Equivalent to the original's
   * `INT(RND * n + 1)` idiom, which every random draw in the game used.
   */
  nextInt(maxInclusive: number): number;
}

/**
 * mulberry32. Chosen for being small, fast, and well distributed. The original
 * used the BASIC PDS generator; reproducing it is explicitly not a goal, and
 * every formula is written against a uniform in [0, 1) so the substitution is
 * invisible to game behavior.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt: (maxInclusive: number) => Math.floor(next() * maxInclusive) + 1,
  };
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm test -- rng`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/engine/rng.ts test/engine/rng.test.ts
git commit -m "Add project scaffolding and seeded RNG"
```

---

## Task 2: Types and recovered constants

**Files:**
- Create: `src/engine/types.ts`, `src/engine/constants.ts`
- Test: `test/engine/constants.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type NewsEvent = "sugar" | "lemons" | "cups"`
  - `interface Weather { temperatureF: number; chanceOfRain: number }`
  - `interface Decision { glassesMade: number; priceCents: number }`
  - `interface DayOutcome { day: number; weather: Weather; rained: boolean; event: NewsEvent | null; costPerGlassCents: number; glassesMade: number; glassesSold: number; totalCostCents: number; totalSalesCents: number; profitCents: number; cashCents: number }`
  - `interface GameState { seed: number; day: number; cashCents: number; costPerGlassCents: number; coefficients: Coefficients; pendingWeather: Weather; pendingEvent: NewsEvent | null; history: DayOutcome[]; finished: boolean }`
  - `type Coefficients = readonly [number, number, number, number]`
  - Constants: `STARTING_CASH_CENTS`, `STARTING_COST_CENTS`, `MAX_GLASSES_PER_DAY`, `MAX_PRICE_CENTS`, `RUN_LENGTH_DAYS`, `COST_EVENT_CEILING_CENTS`, `TEMPERATURE_BAND_EDGES`, `PRICE_BANDS`

- [ ] **Step 1: Write the failing test**

`test/engine/constants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_GLASSES_PER_DAY,
  MAX_PRICE_CENTS,
  PRICE_BANDS,
  STARTING_CASH_CENTS,
  STARTING_COST_CENTS,
  TEMPERATURE_BAND_EDGES,
} from "../../src/engine/constants";

describe("recovered constants", () => {
  it("matches the values read out of the binary", () => {
    expect(STARTING_CASH_CENTS).toBe(100);
    expect(STARTING_COST_CENTS).toBe(2);
    expect(MAX_GLASSES_PER_DAY).toBe(60000);
    expect(MAX_PRICE_CENTS).toBe(20000);
  });

  it("has four temperature bands", () => {
    expect(TEMPERATURE_BAND_EDGES).toEqual([70, 80, 90, 96]);
  });

  it("has eight price bands with four coefficients each", () => {
    expect(PRICE_BANDS).toHaveLength(8);
    for (const band of PRICE_BANDS) {
      expect(band.coefficients).toHaveLength(4);
    }
  });

  it("leaves a gap at exactly 126 cents, as the original does", () => {
    const matching = PRICE_BANDS.filter(
      (b) => 126 > b.aboveCents && 126 <= b.throughCents,
    );
    expect(matching).toHaveLength(0);
  });

  it("matches every band on either side of the gap", () => {
    for (const price of [12, 25, 50, 75, 125, 127, 150, 200, 201]) {
      const matching = PRICE_BANDS.filter(
        (b) => price > b.aboveCents && price <= b.throughCents,
      );
      expect(matching, `price ${price}`).toHaveLength(1);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- constants`
Expected: FAIL, cannot resolve `../../src/engine/constants`.

- [ ] **Step 3: Implement the types**

`src/engine/types.ts`:

```ts
export type NewsEvent = "sugar" | "lemons" | "cups";

export interface Weather {
  /** Degrees Fahrenheit, always 71 to 105 inclusive. */
  temperatureF: number;
  /** Percent, 0 to 100. Zero means the day is guaranteed dry. */
  chanceOfRain: number;
}

export interface Decision {
  glassesMade: number;
  priceCents: number;
}

/**
 * Demand coefficients in hundredths, one per temperature band, ordered to
 * match TEMPERATURE_BAND_EDGES.
 */
export type Coefficients = readonly [number, number, number, number];

export interface DayOutcome {
  day: number;
  weather: Weather;
  rained: boolean;
  event: NewsEvent | null;
  costPerGlassCents: number;
  glassesMade: number;
  glassesSold: number;
  totalCostCents: number;
  totalSalesCents: number;
  profitCents: number;
  cashCents: number;
}

export interface GameState {
  seed: number;
  /** 1-based index of the day awaiting a decision. */
  day: number;
  cashCents: number;
  costPerGlassCents: number;
  /**
   * Carried across days because a price of exactly 126 cents matches no band
   * and leaves these untouched, exactly as the original does.
   */
  coefficients: Coefficients;
  pendingWeather: Weather;
  pendingEvent: NewsEvent | null;
  history: DayOutcome[];
  finished: boolean;
}
```

- [ ] **Step 4: Implement the constants**

`src/engine/constants.ts`:

```ts
import type { Coefficients } from "./types";

export const STARTING_CASH_CENTS = 100;      // $1.00
export const STARTING_COST_CENTS = 2;        // $0.02
export const MAX_GLASSES_PER_DAY = 60000;
export const MAX_PRICE_CENTS = 20000;        // $200.00
export const RUN_LENGTH_DAYS = 30;

/** News events stop firing once cost reaches this, so cost plateaus. */
export const COST_EVENT_CEILING_CENTS = 12;  // $0.12

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
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm test -- constants`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/constants.ts test/engine/constants.test.ts
git commit -m "Add engine types and recovered constants"
```

---

## Task 3: News events and per glass cost

**Files:**
- Create: `src/engine/cost.ts`
- Test: `test/engine/cost.test.ts`

**Interfaces:**
- Consumes: `Rng` from Task 1; `NewsEvent` from Task 2; `COST_EVENT_CEILING_CENTS` from Task 2.
- Produces: `rollNewsEvent(costPerGlassCents: number, rng: Rng): { costPerGlassCents: number; event: NewsEvent | null }`. Pure. Always consumes exactly one draw when cost is below the ceiling, and none otherwise.

- [ ] **Step 1: Write the failing test**

`test/engine/cost.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rollNewsEvent } from "../../src/engine/cost";
import type { Rng } from "../../src/engine/rng";

/** An Rng that returns exactly the rolls we want from nextInt. */
function scriptedRng(rolls: number[]): Rng {
  let i = 0;
  return {
    next: () => 0,
    nextInt: () => {
      const v = rolls[i];
      if (v === undefined) throw new Error("scripted rng exhausted");
      i++;
      return v;
    },
  };
}

describe("rollNewsEvent", () => {
  it("raises cost by 2 cents on a sugar roll", () => {
    const r = rollNewsEvent(2, scriptedRng([1]));
    expect(r.event).toBe("sugar");
    expect(r.costPerGlassCents).toBe(4);
  });

  it("raises cost by 3 cents on a lemons roll", () => {
    const r = rollNewsEvent(2, scriptedRng([11]));
    expect(r.event).toBe("lemons");
    expect(r.costPerGlassCents).toBe(5);
  });

  it("raises cost by 4 cents on a cups roll", () => {
    const r = rollNewsEvent(2, scriptedRng([21]));
    expect(r.event).toBe("cups");
    expect(r.costPerGlassCents).toBe(6);
  });

  it("does nothing on a roll above 25", () => {
    const r = rollNewsEvent(2, scriptedRng([26]));
    expect(r.event).toBeNull();
    expect(r.costPerGlassCents).toBe(2);
  });

  it("uses the documented band edges", () => {
    expect(rollNewsEvent(2, scriptedRng([10])).event).toBe("sugar");
    expect(rollNewsEvent(2, scriptedRng([20])).event).toBe("lemons");
    expect(rollNewsEvent(2, scriptedRng([25])).event).toBe("cups");
    expect(rollNewsEvent(2, scriptedRng([100])).event).toBeNull();
  });

  it("stops firing once cost reaches the ceiling, without drawing", () => {
    const rng = scriptedRng([]); // throws if drawn from
    const r = rollNewsEvent(12, rng);
    expect(r.event).toBeNull();
    expect(r.costPerGlassCents).toBe(12);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- cost`
Expected: FAIL, cannot resolve `../../src/engine/cost`.

- [ ] **Step 3: Implement**

`src/engine/cost.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- cost`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/cost.ts test/engine/cost.test.ts
git commit -m "Add news events and per glass cost"
```

---

## Task 4: Weather generation and rain

**Files:**
- Create: `src/engine/weather.ts`
- Test: `test/engine/weather.test.ts`

**Interfaces:**
- Consumes: `Rng` from Task 1; `Weather` from Task 2.
- Produces:
  - `generateWeather(rng: Rng): Weather`. Consumes exactly two draws, chance of rain first, then temperature.
  - `resolveRain(chanceOfRain: number, rng: Rng): boolean`. Consumes one draw, or none when the chance is zero.

- [ ] **Step 1: Write the failing test**

`test/engine/weather.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createRng } from "../../src/engine/rng";
import type { Rng } from "../../src/engine/rng";
import { generateWeather, resolveRain } from "../../src/engine/weather";

function scriptedRng(rolls: number[]): Rng {
  let i = 0;
  return {
    next: () => 0,
    nextInt: () => {
      const v = rolls[i];
      if (v === undefined) throw new Error("scripted rng exhausted");
      i++;
      return v;
    },
  };
}

describe("generateWeather", () => {
  it("uses a rain roll below 70 as the chance of rain", () => {
    const w = generateWeather(scriptedRng([42, 10]));
    expect(w.chanceOfRain).toBe(42);
  });

  it("forces the chance to zero when the roll is 70 or above", () => {
    expect(generateWeather(scriptedRng([70, 10])).chanceOfRain).toBe(0);
    expect(generateWeather(scriptedRng([100, 10])).chanceOfRain).toBe(0);
  });

  it("offsets the temperature draw by 70", () => {
    expect(generateWeather(scriptedRng([1, 1])).temperatureF).toBe(71);
    expect(generateWeather(scriptedRng([1, 35])).temperatureF).toBe(105);
  });

  it("never produces a temperature outside 71 to 105", () => {
    const rng = createRng(4242);
    for (let i = 0; i < 5000; i++) {
      const w = generateWeather(rng);
      expect(w.temperatureF).toBeGreaterThanOrEqual(71);
      expect(w.temperatureF).toBeLessThanOrEqual(105);
      expect(w.chanceOfRain).toBeGreaterThanOrEqual(0);
      expect(w.chanceOfRain).toBeLessThan(70);
    }
  });
});

describe("resolveRain", () => {
  it("never rains when the chance is zero, and does not draw", () => {
    expect(resolveRain(0, scriptedRng([]))).toBe(false);
  });

  it("rains when the roll is at or below the chance", () => {
    expect(resolveRain(50, scriptedRng([50]))).toBe(true);
    expect(resolveRain(50, scriptedRng([1]))).toBe(true);
  });

  it("stays dry when the roll is above the chance", () => {
    expect(resolveRain(50, scriptedRng([51]))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- weather`
Expected: FAIL, cannot resolve `../../src/engine/weather`.

- [ ] **Step 3: Implement**

`src/engine/weather.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- weather`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/weather.ts test/engine/weather.test.ts
git commit -m "Add weather generation and rain resolution"
```

---

## Task 5: Demand

**Files:**
- Create: `src/engine/demand.ts`
- Test: `test/engine/demand.test.ts`

**Interfaces:**
- Consumes: `Rng` from Task 1; `Coefficients` from Task 2; `PRICE_BANDS`, `TEMPERATURE_BAND_EDGES` from Task 2.
- Produces:
  - `selectCoefficients(previous: Coefficients, priceCents: number): Coefficients`. Pure, no draws. Returns `previous` unchanged when no band matches.
  - `applyJitter(coefficients: Coefficients, priceCents: number, rng: Rng): Coefficients`. Always consumes exactly one draw.
  - `temperatureBandIndex(temperatureF: number): number`. Returns 0 to 3.
  - `glassesSold(glassesMade: number, coefficientHundredths: number): number`.

- [ ] **Step 1: Write the failing test**

`test/engine/demand.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Rng } from "../../src/engine/rng";
import type { Coefficients } from "../../src/engine/types";
import {
  applyJitter,
  glassesSold,
  selectCoefficients,
  temperatureBandIndex,
} from "../../src/engine/demand";

function scriptedRng(rolls: number[]): Rng {
  let i = 0;
  return {
    next: () => 0,
    nextInt: () => {
      const v = rolls[i];
      if (v === undefined) throw new Error("scripted rng exhausted");
      i++;
      return v;
    },
  };
}

const ZERO: Coefficients = [0, 0, 0, 0];

describe("selectCoefficients", () => {
  it("picks the cheapest band for a low price", () => {
    expect(selectCoefficients(ZERO, 5)).toEqual([80, 90, 100, 100]);
  });

  it("uses upper inclusive edges", () => {
    expect(selectCoefficients(ZERO, 12)).toEqual([80, 90, 100, 100]);
    expect(selectCoefficients(ZERO, 13)).toEqual([70, 80, 90, 100]);
    expect(selectCoefficients(ZERO, 125)).toEqual([40, 50, 60, 70]);
  });

  it("zeroes demand above $2.00", () => {
    expect(selectCoefficients(ZERO, 201)).toEqual([0, 0, 0, 0]);
  });

  it("keeps the previous coefficients at exactly 126 cents", () => {
    const previous: Coefficients = [40, 50, 60, 70];
    expect(selectCoefficients(previous, 126)).toBe(previous);
  });
});

describe("temperatureBandIndex", () => {
  it("maps each band, lower inclusive and upper exclusive", () => {
    expect(temperatureBandIndex(71)).toBe(0);
    expect(temperatureBandIndex(79)).toBe(0);
    expect(temperatureBandIndex(80)).toBe(1);
    expect(temperatureBandIndex(89)).toBe(1);
    expect(temperatureBandIndex(90)).toBe(2);
    expect(temperatureBandIndex(95)).toBe(2);
    expect(temperatureBandIndex(96)).toBe(3);
    expect(temperatureBandIndex(105)).toBe(3);
  });
});

describe("applyJitter", () => {
  it("adds the roll as hundredths", () => {
    expect(applyJitter([40, 50, 60, 70], 100, scriptedRng([5]))).toEqual([
      45, 55, 65, 75,
    ]);
  });

  it("clamps at 100", () => {
    expect(applyJitter([95, 100, 100, 100], 100, scriptedRng([10]))).toEqual([
      100, 100, 100, 100,
    ]);
  });

  it("adds nothing above $2.00 but still draws", () => {
    const rng = scriptedRng([10]);
    expect(applyJitter([0, 0, 0, 0], 201, rng)).toEqual([0, 0, 0, 0]);
  });
});

describe("glassesSold", () => {
  it("floors the product", () => {
    expect(glassesSold(10, 85)).toBe(8);
    expect(glassesSold(100, 80)).toBe(80);
    expect(glassesSold(0, 100)).toBe(0);
  });

  it("never exceeds glasses made", () => {
    expect(glassesSold(50, 100)).toBe(50);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- demand`
Expected: FAIL, cannot resolve `../../src/engine/demand`.

- [ ] **Step 3: Implement**

`src/engine/demand.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- demand`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/demand.ts test/engine/demand.test.ts
git commit -m "Add demand model"
```

---

## Task 6: The day loop

**Files:**
- Create: `src/engine/game.ts`, `src/engine/index.ts`
- Test: `test/engine/game.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1 through 5.
- Produces:
  - `startRun(seed: number): GameState`
  - `maxAffordableGlasses(state: GameState): number`
  - `validateDecision(state: GameState, decision: Decision): string | null`, returning an error message or `null`
  - `advanceDay(state: GameState, decision: Decision): GameState`
  - `finalScoreCents(state: GameState): number`
  - `src/engine/index.ts` re-exports these plus the types and constants.

Note on the generator: `GameState` is plain data and must stay serializable, so
it holds a `seed` and the engine rebuilds the generator from
`seed + day` on each call rather than storing generator state. That keeps
`advanceDay` pure and keeps saved games portable.

- [ ] **Step 1: Write the failing test**

`test/engine/game.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  advanceDay,
  finalScoreCents,
  maxAffordableGlasses,
  startRun,
  validateDecision,
} from "../../src/engine/game";
import { RUN_LENGTH_DAYS } from "../../src/engine/constants";

describe("startRun", () => {
  it("starts with a dollar, two cent glasses, and day one", () => {
    const s = startRun(1);
    expect(s.cashCents).toBe(100);
    expect(s.costPerGlassCents).toBe(2);
    expect(s.day).toBe(1);
    expect(s.history).toEqual([]);
    expect(s.finished).toBe(false);
  });

  it("has weather ready before the first decision", () => {
    const s = startRun(1);
    expect(s.pendingWeather.temperatureF).toBeGreaterThanOrEqual(71);
  });

  it("is deterministic for a seed", () => {
    expect(startRun(77)).toEqual(startRun(77));
  });
});

describe("maxAffordableGlasses", () => {
  it("is cash divided by cost, floored", () => {
    const s = startRun(1);
    expect(maxAffordableGlasses(s)).toBe(Math.floor(100 / s.costPerGlassCents));
  });

  it("is capped at 60000", () => {
    const s = { ...startRun(1), cashCents: 100_000_000 };
    expect(maxAffordableGlasses(s)).toBe(60000);
  });
});

describe("validateDecision", () => {
  it("accepts a decision within limits", () => {
    const s = startRun(1);
    expect(validateDecision(s, { glassesMade: 10, priceCents: 25 })).toBeNull();
  });

  it("rejects more glasses than affordable", () => {
    const s = startRun(1);
    const tooMany = maxAffordableGlasses(s) + 1;
    expect(
      validateDecision(s, { glassesMade: tooMany, priceCents: 25 }),
    ).toMatch(/afford/i);
  });

  it("rejects a price above the cap", () => {
    const s = startRun(1);
    expect(
      validateDecision(s, { glassesMade: 1, priceCents: 20001 }),
    ).toMatch(/price/i);
  });

  it("rejects negative and fractional input", () => {
    const s = startRun(1);
    expect(validateDecision(s, { glassesMade: -1, priceCents: 25 })).not.toBeNull();
    expect(validateDecision(s, { glassesMade: 1.5, priceCents: 25 })).not.toBeNull();
  });
});

describe("advanceDay", () => {
  it("records an outcome and moves to the next day", () => {
    const s0 = startRun(5);
    const s1 = advanceDay(s0, { glassesMade: 10, priceCents: 25 });
    expect(s1.day).toBe(2);
    expect(s1.history).toHaveLength(1);
    expect(s1.history[0]!.glassesMade).toBe(10);
  });

  it("does not mutate the state passed in", () => {
    const s0 = startRun(5);
    const snapshot = structuredClone(s0);
    advanceDay(s0, { glassesMade: 10, priceCents: 25 });
    expect(s0).toEqual(snapshot);
  });

  it("charges for glasses made even when it rains", () => {
    let s = startRun(3);
    // Find a day the engine rains on, then check the books.
    for (let i = 0; i < RUN_LENGTH_DAYS; i++) {
      const next = advanceDay(s, { glassesMade: 10, priceCents: 25 });
      const day = next.history[next.history.length - 1]!;
      if (day.rained) {
        expect(day.glassesSold).toBe(0);
        expect(day.totalSalesCents).toBe(0);
        expect(day.totalCostCents).toBe(10 * day.costPerGlassCents);
        expect(day.profitCents).toBe(-day.totalCostCents);
        return;
      }
      s = next;
      if (s.finished) break;
    }
    throw new Error("no rainy day found in a full run; widen the search");
  });

  it("finishes after the configured run length", () => {
    let s = startRun(11);
    for (let i = 0; i < RUN_LENGTH_DAYS; i++) {
      expect(s.finished).toBe(false);
      s = advanceDay(s, { glassesMade: 1, priceCents: 25 });
    }
    expect(s.finished).toBe(true);
    expect(s.history).toHaveLength(RUN_LENGTH_DAYS);
    expect(finalScoreCents(s)).toBe(s.cashCents);
  });

  it("keeps cash and sold counts sane across many seeds", () => {
    for (let seed = 0; seed < 50; seed++) {
      let s = startRun(seed);
      while (!s.finished) {
        const made = Math.min(maxAffordableGlasses(s), 40);
        const day = advanceDay(s, { glassesMade: made, priceCents: 25 });
        const last = day.history[day.history.length - 1]!;
        expect(last.glassesSold).toBeLessThanOrEqual(last.glassesMade);
        expect(last.glassesSold).toBeGreaterThanOrEqual(0);
        s = day;
      }
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- game`
Expected: FAIL, cannot resolve `../../src/engine/game`.

- [ ] **Step 3: Implement**

`src/engine/game.ts`:

```ts
import {
  MAX_GLASSES_PER_DAY,
  MAX_PRICE_CENTS,
  RUN_LENGTH_DAYS,
  STARTING_CASH_CENTS,
  STARTING_COST_CENTS,
} from "./constants";
import { rollNewsEvent } from "./cost";
import {
  applyJitter,
  glassesSold as computeGlassesSold,
  selectCoefficients,
  temperatureBandIndex,
} from "./demand";
import { createRng } from "./rng";
import { generateWeather, resolveRain } from "./weather";
import type { Coefficients, Decision, DayOutcome, GameState } from "./types";

const INITIAL_COEFFICIENTS: Coefficients = [0, 0, 0, 0];

/**
 * Two independent generators per day, both derived from the run seed. Keeps
 * GameState plain serializable data instead of carrying live generator state,
 * so a saved game is just JSON and advanceDay stays a pure function.
 *
 * They are separate on purpose. Setup draws (the news event and the weather)
 * happen when the previous day ends, and resolution draws (rain and jitter)
 * happen when the player commits. A single shared stream would force
 * advanceDay to replay the setup draws just to reach the right position, and
 * that replay would silently desynchronise the moment rollNewsEvent stops
 * drawing at the cost ceiling.
 */
function setupRngFor(seed: number, day: number) {
  return createRng((seed ^ (day * 0x9e3779b1)) >>> 0);
}

function resolveRngFor(seed: number, day: number) {
  return createRng((seed ^ (day * 0x85ebca6b) ^ 0x5bf03635) >>> 0);
}

export function startRun(seed: number): GameState {
  const setup = setupRngFor(seed, 1);
  const { costPerGlassCents, event } = rollNewsEvent(
    STARTING_COST_CENTS,
    setup,
  );
  return {
    seed,
    day: 1,
    cashCents: STARTING_CASH_CENTS,
    costPerGlassCents,
    coefficients: INITIAL_COEFFICIENTS,
    pendingWeather: generateWeather(setup),
    pendingEvent: event,
    history: [],
    finished: false,
  };
}

export function maxAffordableGlasses(state: GameState): number {
  const affordable = Math.floor(state.cashCents / state.costPerGlassCents);
  return Math.max(0, Math.min(affordable, MAX_GLASSES_PER_DAY));
}

export function validateDecision(
  state: GameState,
  decision: Decision,
): string | null {
  const { glassesMade, priceCents } = decision;
  if (!Number.isInteger(glassesMade) || glassesMade < 0) {
    return "Glasses must be a whole number, zero or more.";
  }
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    return "Price must be a whole number of cents, zero or more.";
  }
  if (glassesMade > maxAffordableGlasses(state)) {
    return `You can only afford ${maxAffordableGlasses(state)} glasses.`;
  }
  if (priceCents > MAX_PRICE_CENTS) {
    return `Price cannot exceed ${MAX_PRICE_CENTS} cents.`;
  }
  return null;
}

export function advanceDay(state: GameState, decision: Decision): GameState {
  if (state.finished) return state;

  const rng = resolveRngFor(state.seed, state.day);
  const weather = state.pendingWeather;
  const rained = resolveRain(weather.chanceOfRain, rng);

  const base = selectCoefficients(state.coefficients, decision.priceCents);
  const coefficients = applyJitter(base, decision.priceCents, rng);
  const band = temperatureBandIndex(weather.temperatureF);
  const sold = rained
    ? 0
    : computeGlassesSold(decision.glassesMade, coefficients[band]!);

  const totalCostCents = decision.glassesMade * state.costPerGlassCents;
  const totalSalesCents = sold * decision.priceCents;
  const profitCents = totalSalesCents - totalCostCents;
  const cashCents = state.cashCents + profitCents;

  const outcome: DayOutcome = {
    day: state.day,
    weather,
    rained,
    event: state.pendingEvent,
    costPerGlassCents: state.costPerGlassCents,
    glassesMade: decision.glassesMade,
    glassesSold: sold,
    totalCostCents,
    totalSalesCents,
    profitCents,
    cashCents,
  };

  const nextDay = state.day + 1;
  const finished = nextDay > RUN_LENGTH_DAYS;
  const setup = setupRngFor(state.seed, nextDay);
  const nextCost = rollNewsEvent(state.costPerGlassCents, setup);

  return {
    ...state,
    day: nextDay,
    cashCents,
    costPerGlassCents: finished
      ? state.costPerGlassCents
      : nextCost.costPerGlassCents,
    coefficients,
    pendingWeather: finished ? weather : generateWeather(setup),
    pendingEvent: finished ? null : nextCost.event,
    history: [...state.history, outcome],
    finished,
    // Note: the persisted coefficients are the jittered ones, not `base`.
    // The original adds the jitter into the same variables the price band
    // wrote, so at the 126 cent gap it is the previous day's jittered values
    // that survive, and today's jitter stacks on top of them.
  };
}

export function finalScoreCents(state: GameState): number {
  return state.cashCents;
}
```

`src/engine/index.ts`:

```ts
export * from "./constants";
export * from "./game";
export * from "./types";
export { createRng } from "./rng";
export type { Rng } from "./rng";
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- game`
Expected: PASS, 13 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, all engine tests.

- [ ] **Step 6: Commit**

```bash
git add src/engine/game.ts src/engine/index.ts test/engine/game.test.ts
git commit -m "Add day loop and run lifecycle"
```

---

## Task 7: Engine purity guard

**Files:**
- Test: `test/engine/purity.test.ts`

**Interfaces:**
- Consumes: the engine source files.
- Produces: nothing at runtime. A test that fails if the engine ever reaches for ambient state.

This is worth its own task because it is the constraint the whole design rests
on, and it is the one a future change is most likely to break silently.

- [ ] **Step 1: Write the test**

`test/engine/purity.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ENGINE_DIR = join(import.meta.dirname, "../../src/engine");
const FORBIDDEN = [
  "Math.random",
  "Date.now",
  "new Date",
  "localStorage",
  "sessionStorage",
  "window.",
  "document.",
  "fetch(",
];

describe("engine purity", () => {
  const files = readdirSync(ENGINE_DIR).filter((f) => f.endsWith(".ts"));

  it("has engine files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} does not reach for ambient state`, () => {
      const source = readFileSync(join(ENGINE_DIR, file), "utf8");
      for (const needle of FORBIDDEN) {
        expect(source, `${file} must not use ${needle}`).not.toContain(needle);
      }
    });
  }
});
```

- [ ] **Step 2: Run the test and confirm it passes**

Run: `npm test -- purity`
Expected: PASS. If it fails, the offending engine file is genuinely impure and
must be fixed rather than the test relaxed.

- [ ] **Step 3: Commit**

```bash
git add test/engine/purity.test.ts
git commit -m "Add engine purity guard"
```

---

## Task 8: Sanity check against the original

**Files:**
- Create: `docs/sanity-check.md`

**Interfaces:**
- Consumes: the finished engine.
- Produces: a short written record of the comparison. No source changes unless
  a discrepancy is found.

This is the spec's proportionate substitute for a differential oracle. It is a
smoke test for gross errors such as an inverted comparison or a factor of ten,
not a proof of equivalence. Budget about an hour.

- [ ] **Step 1: Run the original**

```bash
dosbox-x -c "MOUNT C ./original" -c "C:" -c "LEMON LOCAL"
```

Play several days, varying price across the band edges (5, 12, 13, 50, 125,
126, 127, 201 cents) and noting temperature, chance of rain, glasses made,
glasses sold, and cash after each day.

- [ ] **Step 2: Reproduce each observation against the engine**

For each recorded day, call the engine's pieces directly with the same inputs
and compare glasses sold. Use `selectCoefficients`, `temperatureBandIndex` and
`glassesSold` rather than `advanceDay`, since the random draws will not line up
between the two programs.

- [ ] **Step 3: Write up the result**

Create `docs/sanity-check.md` recording what was compared, what matched, and
anything that did not. Note explicitly that the jitter of 1 to 10 hundredths
means a single observation cannot pin the coefficient exactly, so compare
against the range the model predicts rather than a single number.

- [ ] **Step 4: Commit**

```bash
git add docs/sanity-check.md
git commit -m "Record sanity check against the original binary"
```

---

## Task 9: Storage wrapper

**Files:**
- Create: `src/storage/store.ts`
- Test: `test/storage/store.test.ts`

**Interfaces:**
- Consumes: `GameState` from Task 2.
- Produces:
  - `interface Saved { version: 1; run: GameState | null; highScores: HighScore[] }`
  - `interface HighScore { scoreCents: number; day: string }`
  - `loadSaved(backend?: StorageBackend): Saved`
  - `saveRun(run: GameState | null, backend?: StorageBackend): void`
  - `recordScore(scoreCents: number, isoDate: string, backend?: StorageBackend): void`
  - `interface StorageBackend { getItem(k: string): string | null; setItem(k: string, v: string): void }`

The backend is injected so the tests do not need a DOM, and so a browser that
throws on storage access degrades to memory instead of breaking the game.

- [ ] **Step 1: Write the failing test**

`test/storage/store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  loadSaved,
  recordScore,
  saveRun,
  type StorageBackend,
} from "../../src/storage/store";
import { startRun } from "../../src/engine/game";

function memoryBackend(): StorageBackend {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

function throwingBackend(): StorageBackend {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
}

describe("store", () => {
  it("returns empty state when nothing is stored", () => {
    const saved = loadSaved(memoryBackend());
    expect(saved.run).toBeNull();
    expect(saved.highScores).toEqual([]);
  });

  it("round trips a run", () => {
    const backend = memoryBackend();
    const run = startRun(42);
    saveRun(run, backend);
    expect(loadSaved(backend).run).toEqual(run);
  });

  it("keeps high scores sorted, highest first", () => {
    const backend = memoryBackend();
    recordScore(500, "2026-01-01", backend);
    recordScore(1500, "2026-01-02", backend);
    recordScore(1000, "2026-01-03", backend);
    expect(loadSaved(backend).highScores.map((h) => h.scoreCents)).toEqual([
      1500, 1000, 500,
    ]);
  });

  it("degrades quietly when storage throws", () => {
    const backend = throwingBackend();
    expect(() => saveRun(startRun(1), backend)).not.toThrow();
    expect(loadSaved(backend)).toEqual({
      version: 1,
      run: null,
      highScores: [],
    });
  });

  it("ignores corrupt stored data", () => {
    const backend = memoryBackend();
    backend.setItem("lemonade.v1", "{not json");
    expect(loadSaved(backend).run).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- store`
Expected: FAIL, cannot resolve `../../src/storage/store`.

- [ ] **Step 3: Implement**

`src/storage/store.ts`:

```ts
import type { GameState } from "../engine/types";

const KEY = "lemonade.v1";
const MAX_HIGH_SCORES = 10;

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface HighScore {
  scoreCents: number;
  day: string;
}

export interface Saved {
  version: 1;
  run: GameState | null;
  highScores: HighScore[];
}

const EMPTY: Saved = { version: 1, run: null, highScores: [] };

/**
 * Browsers can refuse storage entirely (private windows, blocked site data),
 * and stored data can be corrupt or from an older schema. Every path here
 * falls back to an empty in memory state rather than throwing, because losing
 * a saved game is a far better failure than a blank screen.
 */
function defaultBackend(): StorageBackend | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(backend: StorageBackend | null): Saved {
  if (!backend) return { ...EMPTY };
  try {
    const raw = backend.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    if (parsed.version !== 1) return { ...EMPTY };
    return {
      version: 1,
      run: parsed.run ?? null,
      highScores: Array.isArray(parsed.highScores) ? parsed.highScores : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function write(backend: StorageBackend | null, saved: Saved): void {
  if (!backend) return;
  try {
    backend.setItem(KEY, JSON.stringify(saved));
  } catch {
    // Storage unavailable. The session continues in memory.
  }
}

export function loadSaved(backend = defaultBackend()): Saved {
  return read(backend);
}

export function saveRun(
  run: GameState | null,
  backend = defaultBackend(),
): void {
  write(backend, { ...read(backend), run });
}

export function recordScore(
  scoreCents: number,
  isoDate: string,
  backend = defaultBackend(),
): void {
  const saved = read(backend);
  const highScores = [...saved.highScores, { scoreCents, day: isoDate }]
    .sort((a, b) => b.scoreCents - a.scoreCents)
    .slice(0, MAX_HIGH_SCORES);
  write(backend, { ...saved, highScores });
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- store`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/storage/store.ts test/storage/store.test.ts
git commit -m "Add storage wrapper with in memory fallback"
```

---

## Task 10: Visual language

**Files:**
- Create: `src/ui/theme.css`, `src/ui/format.ts`
- Test: `test/ui/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatMoney(cents: number): string` returning `"$1.23"` and
  handling negatives as `"-$1.23"`; `formatCount(n: number): string` with
  thousands separators. CSS custom properties for the palette.

The aesthetic is drawn from the original's screens: the sixteen colour EGA and
VGA palette, a fixed width face, hard edges, heavy contrast. It is a redraw
rather than a copy, and no artwork from the original is reproduced.

- [ ] **Step 1: Write the failing test**

`test/ui/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCount, formatMoney } from "../../src/ui/format";

describe("formatMoney", () => {
  it("formats whole and fractional dollars", () => {
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(5)).toBe("$0.05");
    expect(formatMoney(100)).toBe("$1.00");
    expect(formatMoney(123456)).toBe("$1,234.56");
  });

  it("puts the sign before the symbol", () => {
    expect(formatMoney(-250)).toBe("-$2.50");
  });
});

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(60000)).toBe("60,000");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- format`
Expected: FAIL, cannot resolve `../../src/ui/format`.

- [ ] **Step 3: Implement the formatters**

`src/ui/format.ts`:

```ts
/** Cents to a display string. The sign leads, so negatives read as -$2.50. */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = String(abs % 100).padStart(2, "0");
  return `${sign}$${formatCount(dollars)}.${remainder}`;
}

/** Integer with thousands separators. */
export function formatCount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
```

- [ ] **Step 4: Implement the theme**

`src/ui/theme.css`:

```css
:root {
  --black: #000000;
  --blue: #0000aa;
  --green: #00aa00;
  --cyan: #00aaaa;
  --red: #aa0000;
  --magenta: #aa00aa;
  --brown: #aa5500;
  --light-gray: #aaaaaa;
  --dark-gray: #555555;
  --bright-blue: #5555ff;
  --bright-green: #55ff55;
  --bright-cyan: #55ffff;
  --bright-red: #ff5555;
  --bright-magenta: #ff55ff;
  --yellow: #ffff55;
  --white: #ffffff;

  --bg: var(--black);
  --fg: var(--light-gray);
  --accent: var(--yellow);
  --border: var(--cyan);
  --good: var(--bright-green);
  --bad: var(--bright-red);

  --font-mono: "DejaVu Sans Mono", "Liberation Mono", Menlo, Consolas,
    monospace;
  --cell: 1ch;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: clamp(14px, 2.6vw, 17px);
  line-height: 1.35;
  -webkit-text-size-adjust: 100%;
}

.panel {
  border: 2px solid var(--border);
  padding: 0.75rem;
  background: var(--bg);
}

.panel > h2 {
  margin: -0.75rem -0.75rem 0.75rem;
  padding: 0.25rem 0.75rem;
  background: var(--border);
  color: var(--black);
  font-size: 1em;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.value {
  color: var(--accent);
}
.value--good {
  color: var(--good);
}
.value--bad {
  color: var(--bad);
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm test -- format`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/format.ts src/ui/theme.css test/ui/format.test.ts
git commit -m "Add visual language and formatters"
```

---

## Task 11: Playable interface

**Files:**
- Create: `src/ui/app.ts`
- Modify: `index.html` if the mount point needs adjusting

**Interfaces:**
- Consumes: the engine's public surface from Task 6, the store from Task 9, the
  formatters and theme from Task 10.
- Produces: a working game at `npm run dev`.

The layout descends from the original's play screen: a status strip carrying
days remaining, cash, and cost per glass; a forecast panel; a decision form;
and a results panel. Two columns on a wide viewport, stacked on a narrow one,
with the actions within thumb reach at the bottom.

The numeric inputs here are deliberately plain. The real mobile input surface
is Task 12 and is designed separately. Do not gold plate these.

- [ ] **Step 1: Implement the interface**

`src/ui/app.ts`:

```ts
import "./theme.css";
import {
  advanceDay,
  finalScoreCents,
  maxAffordableGlasses,
  RUN_LENGTH_DAYS,
  startRun,
  validateDecision,
  type GameState,
} from "../engine";
import { loadSaved, recordScore, saveRun } from "../storage/store";
import { formatCount, formatMoney } from "./format";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("missing #app mount point");

let state: GameState = loadSaved().run ?? startRun(Date.now() >>> 0);

function daysLeft(s: GameState): number {
  return RUN_LENGTH_DAYS - s.history.length;
}

function render(): void {
  const last = state.history[state.history.length - 1];
  const affordable = maxAffordableGlasses(state);

  root.innerHTML = `
    <header class="status">
      <span>Day <b class="value">${Math.min(state.day, RUN_LENGTH_DAYS)}</b>/${RUN_LENGTH_DAYS}</span>
      <span>Cash <b class="value">${formatMoney(state.cashCents)}</b></span>
      <span>Cost/glass <b class="value">${formatMoney(state.costPerGlassCents)}</b></span>
    </header>
    <main class="columns">
      <section class="panel">
        <h2>Forecast</h2>
        ${
          state.finished
            ? `<p>The season is over.</p>
               <p>Final takings: <b class="value">${formatMoney(finalScoreCents(state))}</b></p>
               <button id="again">Play again</button>`
            : `<p>High temperature: <b class="value">${state.pendingWeather.temperatureF}&deg;F</b></p>
               <p>Chance of rain: <b class="value">${state.pendingWeather.chanceOfRain}%</b></p>
               ${state.pendingEvent ? `<p class="value--bad">The price of ${state.pendingEvent} has gone up.</p>` : ""}
               <form id="decide">
                 <label>Glasses to make (up to ${formatCount(affordable)})
                   <input id="glasses" type="number" inputmode="numeric"
                          min="0" max="${affordable}" value="0" required />
                 </label>
                 <label>Price per glass, in cents
                   <input id="price" type="number" inputmode="numeric"
                          min="0" max="20000" value="25" required />
                 </label>
                 <p id="error" class="value--bad" role="alert"></p>
                 <button type="submit">Open the stand</button>
               </form>`
        }
      </section>
      <section class="panel">
        <h2>Yesterday</h2>
        ${
          last
            ? `<dl>
                 <dt>Weather</dt><dd>${last.rained ? "Rain. No customers." : `Fair, ${last.weather.temperatureF}&deg;F`}</dd>
                 <dt>Glasses made</dt><dd>${formatCount(last.glassesMade)}</dd>
                 <dt>Glasses sold</dt><dd>${formatCount(last.glassesSold)}</dd>
                 <dt>Sales</dt><dd>${formatMoney(last.totalSalesCents)}</dd>
                 <dt>Costs</dt><dd>${formatMoney(last.totalCostCents)}</dd>
                 <dt>Profit</dt>
                 <dd class="${last.profitCents < 0 ? "value--bad" : "value--good"}">${formatMoney(last.profitCents)}</dd>
               </dl>`
            : "<p>No trading yet.</p>"
        }
      </section>
    </main>
    <footer><span>${formatCount(daysLeft(state))} days left</span></footer>
  `;

  document.querySelector("#again")?.addEventListener("click", () => {
    state = startRun(Date.now() >>> 0);
    saveRun(state);
    render();
  });

  document.querySelector("#decide")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const glasses = Number(
      document.querySelector<HTMLInputElement>("#glasses")?.value,
    );
    const price = Number(
      document.querySelector<HTMLInputElement>("#price")?.value,
    );
    const decision = { glassesMade: glasses, priceCents: price };
    const problem = validateDecision(state, decision);
    const errorEl = document.querySelector("#error");
    if (problem) {
      if (errorEl) errorEl.textContent = problem;
      return;
    }
    state = advanceDay(state, decision);
    if (state.finished) {
      recordScore(finalScoreCents(state), new Date().toISOString().slice(0, 10));
    }
    saveRun(state);
    render();
  });
}

render();
```

- [ ] **Step 2: Add the layout rules**

Append to `src/ui/theme.css`:

```css
.status,
footer {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.75rem;
  border-bottom: 2px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 1;
}

footer {
  position: static;
  border-bottom: 0;
  border-top: 2px solid var(--border);
}

.columns {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 44rem) {
  .columns {
    grid-template-columns: 1fr 1fr;
  }
}

label {
  display: block;
  margin: 0.75rem 0;
}

input {
  display: block;
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.6rem;
  font: inherit;
  color: var(--accent);
  background: var(--black);
  border: 2px solid var(--dark-gray);
}

input:focus-visible,
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

button {
  width: 100%;
  padding: 0.85rem;
  font: inherit;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--black);
  background: var(--accent);
  border: 0;
  cursor: pointer;
}

dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
}

dd {
  margin: 0;
  text-align: right;
  color: var(--accent);
}
```

- [ ] **Step 3: Verify it runs**

Run: `npm run dev`, open the served URL, and play a full run of
`RUN_LENGTH_DAYS` days. Confirm the run ends, a final score is shown, "Play
again" starts a fresh run, and reloading mid-run restores the run in progress.

- [ ] **Step 4: Verify the build and the suite**

Run: `npm run build`
Expected: type check passes and the bundle is produced.

Run: `npm test`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app.ts src/ui/theme.css index.html
git commit -m "Add playable interface"
```

---

## Task 12: Mobile input surface

**Files:**
- Modify: `src/ui/app.ts`, `src/ui/theme.css`

**Interfaces:**
- Consumes: everything from Task 11.
- Produces: a revised decision form. No engine changes.

**Resolved: no change needed. The plain inputs from Task 11 are the answer.**

This task was held open deliberately rather than settled by default, because
two numeric questions a day looked like a poor fit for a phone keyboard and the
replacement was a design decision rather than something to guess at.

- [x] **Step 1: Hold the design conversation**

Held after playing the real thing on a phone. Findings:

- `type="number"` behaves differently by platform in a way that happens to suit
  both. Desktop gets increment steppers; mobile gets no steppers but raises the
  numeric keypad on focus. Neither needed replacing.
- Carrying the previous day's glasses and price into the next day, added
  separately, removed most of the typing the concern was really about. Most
  days became an adjustment rather than fresh entry.
- The alternatives considered and rejected were steppers with tuned increments,
  presets drawn from the price band edges, a price slider with a numeric
  readout, and a "same as yesterday" shortcut. The prefill made the last
  redundant, and the rest would have added furniture without earning it.

Verdict from the owner after phone testing: "the easy thing looks like the
right thing."

- [x] **Step 2: Implement, verify on a phone viewport, and commit**

Nothing to implement. The shipped form is the outcome of this task, not a
placeholder awaiting one.
