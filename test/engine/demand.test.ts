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
