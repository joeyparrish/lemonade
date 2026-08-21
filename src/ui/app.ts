import "./theme.css";
import {
  advanceDay,
  finalScoreCents,
  maxAffordableGlasses,
  RUN_LENGTH_DAYS,
  startRun,
  validateDecision,
  type GameState,
} from "../engine";
import { loadSaved, recordScore, saveRun } from "../storage/store";
import { formatCount, formatMoney } from "./format";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("missing #app mount point");

let state: GameState = loadSaved().run ?? startRun(Date.now() >>> 0);

function daysLeft(s: GameState): number {
  return RUN_LENGTH_DAYS - s.history.length;
}

function newRun(): void {
  state = startRun(Date.now() >>> 0);
  saveRun(state);
  render();
}

function renderForecast(): string {
  if (state.finished) {
    return `
      <p>The season is over.</p>
      <p>Final takings: <b class="value">${formatMoney(finalScoreCents(state))}</b></p>
      <button id="again" type="button">Play again</button>`;
  }
  const affordable = maxAffordableGlasses(state);
  return `
    <p>High temperature: <b class="value">${state.pendingWeather.temperatureF}&deg;F</b></p>
    <p>Chance of rain: <b class="value">${state.pendingWeather.chanceOfRain}%</b></p>
    ${
      state.pendingEvent
        ? `<p class="value--bad">The price of ${state.pendingEvent} has gone up.</p>`
        : ""
    }
    <form id="decide">
      <label>Glasses to make (up to ${formatCount(affordable)})
        <input id="glasses" type="number" inputmode="numeric"
               min="0" max="${affordable}" value="0" required />
      </label>
      <label>Price per glass, in cents
        <input id="price" type="number" inputmode="numeric"
               min="0" max="20000" value="25" required />
      </label>
      <p id="error" class="value--bad" role="alert"></p>
      <button type="submit">Open the stand</button>
    </form>`;
}

function renderYesterday(): string {
  const last = state.history[state.history.length - 1];
  if (!last) return "<p>No trading yet.</p>";
  return `
    <dl>
      <dt>Weather</dt>
      <dd>${last.rained ? "Rain. No customers." : `Fair, ${last.weather.temperatureF}&deg;F`}</dd>
      <dt>Glasses made</dt><dd>${formatCount(last.glassesMade)}</dd>
      <dt>Glasses sold</dt><dd>${formatCount(last.glassesSold)}</dd>
      <dt>Sales</dt><dd>${formatMoney(last.totalSalesCents)}</dd>
      <dt>Costs</dt><dd>${formatMoney(last.totalCostCents)}</dd>
      <dt>Profit</dt>
      <dd class="${last.profitCents < 0 ? "value--bad" : "value--good"}">${formatMoney(last.profitCents)}</dd>
    </dl>`;
}

function submit(event: Event): void {
  event.preventDefault();
  const glasses = Number(
    document.querySelector<HTMLInputElement>("#glasses")?.value,
  );
  const price = Number(document.querySelector<HTMLInputElement>("#price")?.value);
  const decision = { glassesMade: glasses, priceCents: price };
  const problem = validateDecision(state, decision);
  if (problem) {
    const errorEl = document.querySelector("#error");
    if (errorEl) errorEl.textContent = problem;
    return;
  }
  state = advanceDay(state, decision);
  if (state.finished) {
    recordScore(finalScoreCents(state), new Date().toISOString().slice(0, 10));
  }
  saveRun(state);
  render();
}

function render(): void {
  if (!root) return;
  root.innerHTML = `
    <header class="status">
      <span>Day <b class="value">${Math.min(state.day, RUN_LENGTH_DAYS)}</b>/${RUN_LENGTH_DAYS}</span>
      <span>Cash <b class="value">${formatMoney(state.cashCents)}</b></span>
      <span>Cost/glass <b class="value">${formatMoney(state.costPerGlassCents)}</b></span>
    </header>
    <main class="columns">
      <section class="panel">
        <h2>Forecast</h2>
        ${renderForecast()}
      </section>
      <section class="panel">
        <h2>Yesterday</h2>
        ${renderYesterday()}
      </section>
    </main>
    <footer><span>${formatCount(daysLeft(state))} days left</span></footer>
  `;

  document.querySelector("#again")?.addEventListener("click", newRun);
  document.querySelector("#decide")?.addEventListener("submit", submit);
}

render();
