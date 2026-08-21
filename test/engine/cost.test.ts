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
