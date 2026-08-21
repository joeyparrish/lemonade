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
  /**
   * Which screen the player was last on, so closing the tab mid-results does
   * not skip past them on return. Stored as a plain string rather than the
   * UI's Screen union to keep persistence independent of the interface; the
   * UI validates it on the way back in.
   */
  screen: string | null;
}

const EMPTY: Saved = { version: 1, run: null, highScores: [], screen: null };

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
      screen: typeof parsed.screen === "string" ? parsed.screen : null,
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

export function saveScreen(screen: string, backend = defaultBackend()): void {
  write(backend, { ...read(backend), screen });
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
