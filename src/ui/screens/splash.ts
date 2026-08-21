import { STAND, TITLE } from "../art";

export function splashView(showResume: boolean): string {
  return `
    <section class="splash">
      <pre class="art art--title" role="img" aria-label="Lemonade">${TITLE}</pre>
      <pre class="art" aria-hidden="true">${STAND}</pre>
      <p class="tagline">Your mother has given you one dollar.<br />Make it count.</p>
      <nav class="menu">
        ${showResume ? `<button id="resume" type="button">Resume season</button>` : ""}
        <button id="new-game" type="button">New season</button>
        <button id="high-scores" type="button">High scores</button>
      </nav>
    </section>`;
}
