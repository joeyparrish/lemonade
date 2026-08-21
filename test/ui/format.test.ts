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
