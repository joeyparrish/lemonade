import type { GameState } from "../engine";

export type Screen =
  | "splash"
  | "setup"
  | "outcome"
  | "event"
  | "scores"
  | "summary";

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
