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
