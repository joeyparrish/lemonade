import { describe, expect, it } from "vitest";
import {
  loadSaved,
  recordScore,
  saveRun,
  saveScreen,
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

  it("round trips the current screen alongside the run", () => {
    const backend = memoryBackend();
    const run = startRun(7);
    saveRun(run, backend);
    saveScreen("outcome", backend);
    const saved = loadSaved(backend);
    expect(saved.screen).toBe("outcome");
    expect(saved.run).toEqual(run);
  });

  it("reports no screen for a save written before screens were stored", () => {
    const backend = memoryBackend();
    backend.setItem(
      "lemonade.v1",
      JSON.stringify({ version: 1, run: null, highScores: [] }),
    );
    expect(loadSaved(backend).screen).toBeNull();
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

  it("keeps at most ten high scores", () => {
    const backend = memoryBackend();
    for (let i = 1; i <= 15; i++) recordScore(i * 100, "2026-01-01", backend);
    const scores = loadSaved(backend).highScores;
    expect(scores).toHaveLength(10);
    expect(scores[0]!.scoreCents).toBe(1500);
    expect(scores[9]!.scoreCents).toBe(600);
  });

  it("degrades quietly when storage throws", () => {
    const backend = throwingBackend();
    expect(() => saveRun(startRun(1), backend)).not.toThrow();
    expect(loadSaved(backend)).toEqual({
      version: 1,
      run: null,
      highScores: [],
      screen: null,
    });
  });

  it("ignores corrupt stored data", () => {
    const backend = memoryBackend();
    backend.setItem("lemonade.v1", "{not json");
    expect(loadSaved(backend).run).toBeNull();
  });

  it("ignores data from a different schema version", () => {
    const backend = memoryBackend();
    backend.setItem("lemonade.v1", JSON.stringify({ version: 99, run: {} }));
    expect(loadSaved(backend).run).toBeNull();
  });
});
