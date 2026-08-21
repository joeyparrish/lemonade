import type { GameState } from "../engine";

export type Screen =
  | "splash"
  | "setup"
  | "outcome"
  | "event"
  | "scores"
  | "summary";

const SCREENS: readonly Screen[] = [
  "splash",
  "setup",
  "outcome",
  "event",
  "scores",
  "summary",
];

function isScreen(value: string): value is Screen {
  return (SCREENS as readonly string[]).includes(value);
}

/**
 * Work out where a returning player should land, given the screen they were
 * last on and the run that was saved with it.
 *
 * The stored value comes from browser storage and is therefore untrusted: it
 * can be an unknown string, or a screen that cannot exist alongside this run
 * (an event with nothing pending, results with nothing played). Every such
 * case falls back to somewhere coherent rather than rendering an empty screen.
 */
export function restoreScreen(
  saved: string | null,
  run: GameState | null,
): Screen {
  if (!saved || !isScreen(saved)) return "splash";
  if (saved === "splash" || saved === "scores") return saved;
  if (!run) return "splash";
  // Results already earned are worth showing whether or not the run is over,
  // which is the whole point of persisting the screen.
  if (saved === "outcome") return run.history.length > 0 ? "outcome" : "splash";
  if (run.finished) return "summary";
  if (saved === "summary") return "splash";
  if (saved === "event") return run.pendingEvent ? "event" : "setup";
  return "setup";
}

/** A finished run is history, not something to pick back up. */
export function canResume(run: GameState | null): boolean {
  return run !== null && !run.finished;
}

/**
 * Where a fresh run begins. The engine rolls a price event for every day
 * including the first, so day one can open with the news dialog just like any
 * other day.
 */
export function afterNewRun(state: GameState): Screen {
  return state.pendingEvent ? "event" : "setup";
}

/**
 * Where "Next day" leads. The run ending takes precedence: once the season is
 * over there is no next day for a pending event to belong to.
 */
export function afterOutcome(state: GameState): Screen {
  if (state.finished) return "summary";
  return state.pendingEvent ? "event" : "setup";
}
