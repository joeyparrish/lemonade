import { describe, expect, it } from "vitest";
import { advanceDay, startRun, RUN_LENGTH_DAYS } from "../../src/engine";
import type { GameState } from "../../src/engine";
import {
  afterNewRun,
  afterOutcome,
  canResume,
  resumeScreen,
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

describe("resumeScreen", () => {
  const run = startRun(1);
  const played = advanceDay(run, { glassesMade: 1, priceCents: 25 });

  it("has nowhere to resume to without a run in progress", () => {
    expect(resumeScreen("setup", null)).toBe("splash");
    expect(resumeScreen("setup", { ...played, finished: true })).toBe("splash");
  });

  it("returns to the day in progress", () => {
    expect(resumeScreen("setup", run)).toBe("setup");
  });

  it("returns to results the player had not read yet", () => {
    expect(resumeScreen("outcome", played)).toBe("outcome");
  });

  it("returns to a pending price event", () => {
    expect(resumeScreen("event", withEvent(run, "sugar"))).toBe("event");
  });

  it("falls back to setup when nothing was stored", () => {
    expect(resumeScreen(null, run)).toBe("setup");
  });

  it("falls back to setup for a screen name it does not recognise", () => {
    expect(resumeScreen("wharrgarbl", run)).toBe("setup");
  });

  it("falls back to setup for a screen outside the game itself", () => {
    // Browsing the high scores is not a place to resume a game to.
    expect(resumeScreen("scores", run)).toBe("setup");
    expect(resumeScreen("splash", run)).toBe("setup");
  });

  it("falls back to setup when the stored screen cannot exist yet", () => {
    // Results with nothing played, and an event dialog with nothing pending.
    expect(resumeScreen("outcome", run)).toBe("setup");
    expect(resumeScreen("event", withEvent(run, null))).toBe("setup");
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
