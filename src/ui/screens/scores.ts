import type { HighScore } from "../../storage/store";
import { formatMoney } from "../format";

export function scoresView(scores: HighScore[]): string {
  const list =
    scores.length === 0
      ? "<p>No completed seasons yet.</p>"
      : `<ol class="scores">${scores
          .map(
            (s) =>
              `<li><span>${s.day}</span><b class="value">${formatMoney(
                s.scoreCents,
              )}</b></li>`,
          )
          .join("")}</ol>`;
  return `
    <section class="panel">
      <h2>High scores</h2>
      ${list}
      <button id="back" type="button">Back</button>
    </section>`;
}
