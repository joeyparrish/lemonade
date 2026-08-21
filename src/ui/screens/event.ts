import type { NewsEvent } from "../../engine";
import { INGREDIENT_NAMES, eventMessage } from "../art";
import { formatMoney } from "../format";

export function eventView(event: NewsEvent, costPerGlassCents: number): string {
  return `
    <section class="panel dialog" role="alertdialog" aria-labelledby="event-title">
      <h2 id="event-title">Bad news</h2>
      <p class="value--bad event-message">${eventMessage(INGREDIENT_NAMES[event])}</p>
      <p>A glass now costs you
        <b class="value">${formatMoney(costPerGlassCents)}</b> to make.</p>
      <button id="prepare" type="button">Prepare for the day</button>
    </section>`;
}
