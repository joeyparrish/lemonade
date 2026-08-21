import "./theme.css";
import {
  RUN_LENGTH_DAYS,
  advanceDay,
  finalScoreCents,
  startRun,
  validateDecision,
  type GameState,
} from "../engine";
import { loadSaved, recordScore, saveRun, saveScreen } from "../storage/store";
import { formatMoney } from "./format";
import {
  afterNewRun,
  afterOutcome,
  canResume,
  restoreScreen,
  type Screen,
} from "./router";
import { eventView } from "./screens/event";
import { outcomeView } from "./screens/outcome";
import { scoresView } from "./screens/scores";
import { setupView } from "./screens/setup";
import { splashView } from "./screens/splash";
import { summaryView } from "./screens/summary";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("missing #app mount point");

const saved = loadSaved();
let run: GameState | null = saved.run;
let screen: Screen = restoreScreen(saved.screen, run);

/** Screens that belong to a day in progress and so carry the status strip. */
const IN_PLAY: readonly Screen[] = ["setup", "outcome", "event"];

function show(next: Screen): void {
  screen = next;
  saveScreen(next);
  render();
}

function newSeason(): void {
  run = startRun(Date.now() >>> 0);
  saveRun(run);
  show(afterNewRun(run));
}

function openStand(event: Event): void {
  event.preventDefault();
  if (!run) return;
  const glasses = Number(
    document.querySelector<HTMLInputElement>("#glasses")?.value,
  );
  const price = Number(document.querySelector<HTMLInputElement>("#price")?.value);
  const decision = { glassesMade: glasses, priceCents: price };

  const problem = validateDecision(run, decision);
  if (problem) {
    const errorEl = document.querySelector("#error");
    if (errorEl) errorEl.textContent = problem;
    return;
  }

  run = advanceDay(run, decision);
  if (run.finished) {
    recordScore(finalScoreCents(run), new Date().toISOString().slice(0, 10));
  }
  saveRun(run);
  show("outcome");
}

/** Keeps the cents field's label showing the value in dollars as you type. */
function updatePriceEcho(): void {
  const input = document.querySelector<HTMLInputElement>("#price");
  const echo = document.querySelector("#price-echo");
  if (!input || !echo) return;
  const cents = Number(input.value);
  echo.textContent =
    input.value.trim() === "" || Number.isNaN(cents)
      ? ""
      : `(= ${formatMoney(Math.trunc(cents))})`;
}

function body(): string {
  if (screen === "splash") return splashView(canResume(run));
  if (screen === "scores") return scoresView(loadSaved().highScores);
  if (!run) return splashView(canResume(run));
  if (screen === "summary") return summaryView(run);
  if (screen === "event" && run.pendingEvent) {
    return eventView(run.pendingEvent, run.costPerGlassCents);
  }
  if (screen === "outcome") {
    const last = run.history[run.history.length - 1];
    if (last) return outcomeView(last, run.finished);
  }
  return setupView(run);
}

function statusStrip(): string {
  if (!run || !IN_PLAY.includes(screen)) return "";
  // advanceDay has already moved the counter on by the time results are shown,
  // so the strip would otherwise disagree with the "Day N results" heading.
  const lastPlayed = run.history[run.history.length - 1];
  const day =
    screen === "outcome" && lastPlayed
      ? lastPlayed.day
      : Math.min(run.day, RUN_LENGTH_DAYS);
  return `
    <header class="status">
      <span>Day <b class="value">${day}</b>/${RUN_LENGTH_DAYS}</span>
      <span>Cash <b class="value">${formatMoney(run.cashCents)}</b></span>
      <span>Glass <b class="value">${formatMoney(run.costPerGlassCents)}</b></span>
    </header>`;
}

function bind(): void {
  document.querySelector("#new-game")?.addEventListener("click", newSeason);
  document.querySelector("#high-scores")?.addEventListener("click", () => {
    show("scores");
  });
  document.querySelector("#resume")?.addEventListener("click", () => {
    show("setup");
  });
  document.querySelector("#back")?.addEventListener("click", () => {
    show("splash");
  });
  document.querySelector("#prepare")?.addEventListener("click", () => {
    show("setup");
  });
  document.querySelector("#next-day")?.addEventListener("click", () => {
    if (run) show(afterOutcome(run));
  });
  document.querySelector("#decide")?.addEventListener("submit", openStand);
  document.querySelector("#price")?.addEventListener("input", updatePriceEcho);
  // The price field may arrive prefilled from yesterday, so the echo has to be
  // right before the player types anything.
  updatePriceEcho();
}

function render(): void {
  if (!root) return;
  root.innerHTML = `${statusStrip()}<main class="stage">${body()}</main>`;
  bind();
}

render();
