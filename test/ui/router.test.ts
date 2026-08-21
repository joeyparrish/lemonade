import { describe, expect, it } from "vitest";
import { advanceDay, startRun, RUN_LENGTH_DAYS } from "../../src/engine";
import type { GameState } from "../../src/engine";
import {
  afterNewRun,
  afterOutcome,
  canResume,
  restoreScreen,
} from "../../src/ui/router";

function withEvent(state: GameState, event: GameState["pendingEvent"]): GameState {
  return { ...state, pendingEvent: event };
}

describe("canResume", () => {
  it("is false when there is no saved run", () => {
    expect(canResume(null)).toBe(false);
  });

  it("is true for a run in progress", () => {
    expect(canResume(startRun(1))).toBe(true);
  });

  it("is false for a run that already finished", () => {
    let s = startRun(1);
    for (let i = 0; i < RUN_LENGTH_DAYS; i++) {
      s = advanceDay(s, { glassesMade: 0, priceCents: 25 });
    }
    expect(s.finished).toBe(true);
    expect(canResume(s)).toBe(false);
  });
});

describe("afterNewRun", () => {
  it("goes straight to setup when no event is pending", () => {
    expect(afterNewRun(withEvent(startRun(1), null))).toBe("setup");
  });

  it("shows the event first when one is pending", () => {
    expect(afterNewRun(withEvent(startRun(1), "sugar"))).toBe("event");
  });
});

describe("restoreScreen", () => {
  const run = startRun(1);
  const played = advanceDay(run, { glassesMade: 1, priceCents: 25 });

  it("opens on the splash when there is nothing to restore", () => {
    expect(restoreScreen(null, null)).toBe("splash");
    expect(restoreScreen("setup", null)).toBe("splash");
    expect(restoreScreen(null, run)).toBe("splash");
  });

  it("rejects a screen name it does not recognise", () => {
    expect(restoreScreen("wharrgarbl", run)).toBe("splash");
  });

  it("restores a day in progress", () => {
    expect(restoreScreen("setup", run)).toBe("setup");
  });

  it("restores unseen results rather than skipping them", () => {
    expect(restoreScreen("outcome", played)).toBe("outcome");
  });

  it("falls back when the stored screen cannot exist in this state", () => {
    // An outcome screen with nothing played yet.
    expect(restoreScreen("outcome", run)).toBe("splash");
    // An event screen with no event pending.
    expect(restoreScreen("event", withEvent(run, null))).toBe("setup");
  });

  it("sends a finished run to its summary instead of another day", () => {
    const finished: GameState = { ...played, finished: true };
    expect(restoreScreen("setup", finished)).toBe("summary");
    expect(restoreScreen("event", finished)).toBe("summary");
  });

  it("still allows the final results screen of a finished run", () => {
    const finished: GameState = { ...played, finished: true };
    expect(restoreScreen("outcome", finished)).toBe("outcome");
  });
});

describe("afterOutcome", () => {
  it("goes to setup when nothing is pending", () => {
    expect(afterOutcome(withEvent(startRun(1), null))).toBe("setup");
  });

  it("shows a pending price event before the next setup", () => {
    expect(afterOutcome(withEvent(startRun(1), "lemons"))).toBe("event");
  });

  it("goes to the summary once the run is over, even with an event pending", () => {
    const finished: GameState = {
      ...startRun(1),
      finished: true,
      pendingEvent: "cups",
    };
    expect(afterOutcome(finished)).toBe("summary");
  });
});
