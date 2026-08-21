import {
  RUN_LENGTH_DAYS,
  finalScoreCents,
  wentBust,
  type GameState,
} from "../../engine";
import { formatCount, formatMoney } from "../format";

function openingLine(state: GameState): string {
  if (!wentBust(state)) {
    return `You traded for ${RUN_LENGTH_DAYS} days. Let's see what you earned!`;
  }
  const days = state.history.length;
  return `You ran out of cash after ${days} ${
    days === 1 ? "day" : "days"
  }. Better luck next time!`;
}

export function summaryView(state: GameState): string {
  const bestDay = state.history.reduce(
    (best, day) => Math.max(best, day.profitCents),
    0,
  );
  const rainyDays = state.history.filter((d) => d.rained).length;
  const sold = state.history.reduce((total, d) => total + d.glassesSold, 0);
  return `
    <section class="panel">
      <h2>Season over</h2>
      <p>${openingLine(state)}</p>
      <dl>
        <dt>Days traded</dt><dd>${state.history.length} of ${RUN_LENGTH_DAYS}</dd>
        <dt>Final takings</dt>
        <dd class="value">${formatMoney(finalScoreCents(state))}</dd>
        <dt>Glasses sold</dt><dd>${formatCount(sold)}</dd>
        <dt>Best day</dt><dd>${formatMoney(bestDay)}</dd>
        <dt>Rained out</dt><dd>${rainyDays} of ${state.history.length}</dd>
      </dl>
      <button id="back" type="button">Back to menu</button>
    </section>`;
}
