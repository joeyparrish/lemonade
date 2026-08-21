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

  it("never goes negative when the player is in debt", () => {
    const s = { ...startRun(1), cashCents: -500 };
    expect(maxAffordableGlasses(s)).toBe(0);
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
    expect(validateDecision(s, { glassesMade: tooMany, priceCents: 25 })).toMatch(
      /afford/i,
    );
  });

  it("rejects a price above the cap", () => {
    const s = startRun(1);
    expect(validateDecision(s, { glassesMade: 1, priceCents: 20001 })).toMatch(
      /price/i,
    );
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

  it("carries jittered coefficients across the 126 cent gap", () => {
    // Priced at exactly 126 cents every day, no band ever matches, so the
    // coefficients only ever accumulate jitter from their zero start.
    let s = startRun(9);
    const first = advanceDay(s, { glassesMade: 1, priceCents: 126 });
    expect(first.coefficients[0]).toBeGreaterThan(0);
    const second = advanceDay(first, { glassesMade: 1, priceCents: 126 });
    expect(second.coefficients[0]).toBeGreaterThan(first.coefficients[0]!);
  });
});
