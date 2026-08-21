import {
  MAX_GLASSES_PER_DAY,
  MAX_PRICE_CENTS,
  maxAffordableGlasses,
  type GameState,
} from "../../engine";
import { formatCount, formatMoney } from "../format";

export interface Prefill {
  glasses: string;
  price: string;
}

/**
 * What the decision fields should start with.
 *
 * Blank on the first day, so nothing anchors the opening decision. After that
 * yesterday's choice carries forward, since most days are a small adjustment
 * to the last one rather than a fresh judgement. The glass count is clamped to
 * what today's cash actually affords, because offering a figure the form will
 * then reject is worse than offering a smaller one.
 */
export function prefillFor(state: GameState): Prefill {
  const previous = state.history[state.history.length - 1];
  if (!previous) return { glasses: "", price: "" };
  const affordable = maxAffordableGlasses(state);
  return {
    glasses: String(Math.min(previous.glassesMade, affordable)),
    price: String(previous.priceCents),
  };
}

export function setupView(state: GameState): string {
  const affordable = maxAffordableGlasses(state);
  // Once cash outruns the per day cap, say so rather than leaving the player
  // wondering why the number stopped growing. The original did not.
  const capped = affordable === MAX_GLASSES_PER_DAY ? " (max)" : "";
  const prefill = prefillFor(state);
  return `
    <section class="panel">
      <h2>Day ${state.day} forecast</h2>
      <dl>
        <dt>High temperature</dt><dd>${state.pendingWeather.temperatureF}&deg;F</dd>
        <dt>Chance of rain</dt><dd>${state.pendingWeather.chanceOfRain}%</dd>
        <dt>Cost per glass</dt><dd>${formatMoney(state.costPerGlassCents)}</dd>
        <dt>Glasses you can make</dt><dd>${formatCount(affordable)}${capped}</dd>
      </dl>
      <form id="decide">
        <label for="glasses">Glasses to make</label>
        <input id="glasses" type="number" inputmode="numeric"
               min="0" max="${affordable}" placeholder="0"
               value="${prefill.glasses}" required />
        <label for="price">Price per glass, in cents <span id="price-echo"></span></label>
        <input id="price" type="number" inputmode="numeric"
               min="0" max="${MAX_PRICE_CENTS}" placeholder="0"
               value="${prefill.price}" required />
        <p id="error" class="value--bad" role="alert"></p>
        <button type="submit">Open the stand</button>
      </form>
    </section>`;
}
