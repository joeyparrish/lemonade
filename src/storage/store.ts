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

export function saveRun(run: GameState | null, backend = defaultBackend()): void {
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
