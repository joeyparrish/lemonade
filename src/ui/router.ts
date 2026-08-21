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
 * Where the Resume button leads.
 *
 * Loading the page always lands on the splash screen, so returning is never a
 * surprise: nobody gets dropped straight back into a game, or into the high
 * score list, without choosing to be. The screen is still stored, so resuming
 * returns to the exact point the player left, including a day's results they
 * had not yet read.
 *
 * The stored value is untrusted browser data. It can be an unknown string, a
 * screen outside the game proper, or one that cannot exist alongside this run:
 * an event dialog with nothing pending, or results with nothing played.
 * Anything that does not describe a day in progress falls back to setup.
 */
export function resumeScreen(
  saved: string | null,
  run: GameState | null,
): Screen {
  if (!run || run.finished) return "splash";
  if (!saved || !isScreen(saved)) return "setup";
  if (saved === "outcome") return run.history.length > 0 ? "outcome" : "setup";
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
