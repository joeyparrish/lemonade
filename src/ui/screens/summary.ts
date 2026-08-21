import { RUN_LENGTH_DAYS, finalScoreCents, type GameState } from "../../engine";
import { formatCount, formatMoney } from "../format";

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
      <p>You traded for ${RUN_LENGTH_DAYS} days.</p>
      <dl>
        <dt>Final takings</dt>
        <dd class="value">${formatMoney(finalScoreCents(state))}</dd>
        <dt>Glasses sold</dt><dd>${formatCount(sold)}</dd>
        <dt>Best day</dt><dd>${formatMoney(bestDay)}</dd>
        <dt>Rained out</dt><dd>${rainyDays} of ${RUN_LENGTH_DAYS}</dd>
      </dl>
      <button id="back" type="button">Back to menu</button>
    </section>`;
}
