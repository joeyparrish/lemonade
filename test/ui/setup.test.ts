import { describe, expect, it } from "vitest";
import { advanceDay, startRun, type GameState } from "../../src/engine";
import { prefillFor } from "../../src/ui/screens/setup";

const day2 = advanceDay(startRun(5), { glassesMade: 10, priceCents: 30 });

describe("prefillFor", () => {
  it("leaves both fields blank on the first day", () => {
    expect(prefillFor(startRun(5))).toEqual({ glasses: "", price: "" });
  });

  it("carries yesterday's decision forward", () => {
    const rich: GameState = { ...day2, cashCents: 100_000, costPerGlassCents: 2 };
    expect(prefillFor(rich)).toEqual({ glasses: "10", price: "30" });
  });

  it("clamps the glass count to what is affordable today", () => {
    // Eight cents at two cents a glass affords four, not yesterday's ten.
    const poor: GameState = { ...day2, cashCents: 8, costPerGlassCents: 2 };
    expect(prefillFor(poor)).toEqual({ glasses: "4", price: "30" });
  });

  it("offers zero glasses rather than a negative count when broke", () => {
    const broke: GameState = { ...day2, cashCents: 0, costPerGlassCents: 2 };
    expect(prefillFor(broke).glasses).toBe("0");
  });
});
