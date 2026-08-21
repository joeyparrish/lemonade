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
