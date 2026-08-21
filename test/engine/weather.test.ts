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
