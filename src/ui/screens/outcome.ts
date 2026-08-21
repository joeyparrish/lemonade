import type { DayOutcome } from "../../engine";
import { RAIN, RAIN_MESSAGE, SUN, SUNNY_MESSAGE } from "../art";
import { formatCount, formatMoney } from "../format";

export function outcomeView(day: DayOutcome, isLastDay: boolean): string {
  return `
    <section class="panel">
      <h2>Day ${day.day} results</h2>
      <pre class="art ${day.rained ? "art--rain" : "art--sun"}" aria-hidden="true">${
        day.rained ? RAIN : SUN
      }</pre>
      <p class="weather-message">${day.rained ? RAIN_MESSAGE : SUNNY_MESSAGE}</p>
      <dl>
        <dt>Glasses made</dt><dd>${formatCount(day.glassesMade)}</dd>
        <dt>Glasses sold</dt><dd>${formatCount(day.glassesSold)}</dd>
        <dt>Your cost</dt><dd>${formatMoney(day.totalCostCents)}</dd>
        <dt>Total sales</dt><dd>${formatMoney(day.totalSalesCents)}</dd>
        <dt>Profit</dt>
        <dd class="${day.profitCents < 0 ? "value--bad" : "value--good"}">${formatMoney(
          day.profitCents,
        )}</dd>
      </dl>
      <button id="next-day" type="button">
        ${isLastDay ? "See final score" : "Next day"}
      </button>
    </section>`;
}
