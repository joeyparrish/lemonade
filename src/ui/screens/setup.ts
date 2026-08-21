import {
  MAX_GLASSES_PER_DAY,
  MAX_PRICE_CENTS,
  maxAffordableGlasses,
  type GameState,
} from "../../engine";
import { formatCount, formatMoney } from "../format";

export function setupView(state: GameState): string {
  const affordable = maxAffordableGlasses(state);
  // Once cash outruns the per day cap, say so rather than leaving the player
  // wondering why the number stopped growing. The original did not.
  const capped = affordable === MAX_GLASSES_PER_DAY ? " (max)" : "";
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
               min="0" max="${affordable}" placeholder="0" required />
        <label for="price">Price per glass, in cents <span id="price-echo"></span></label>
        <input id="price" type="number" inputmode="numeric"
               min="0" max="${MAX_PRICE_CENTS}" placeholder="0" required />
        <p id="error" class="value--bad" role="alert"></p>
        <button type="submit">Open the stand</button>
      </form>
    </section>`;
}
