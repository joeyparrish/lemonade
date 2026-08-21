/*
 * Block art, drawn for this project in the style of the original's screens
 * rather than copied from them. Everything here is 39 columns or narrower so
 * it fits a narrow phone viewport without scrolling.
 */

/** The word LEMONADE in 5 row block capitals, 39 columns wide. */
export const TITLE = [
  "█    ████ █  █ ████ █  █ ████ ███  ████",
  "█    █    █▌▐█ █  █ ██ █ █  █ █  █ █   ",
  "█    ███  █▐▌█ █  █ █ ██ ████ █  █ ███ ",
  "█    █    █  █ █  █ █  █ █  █ █  █ █   ",
  "████ ████ █  █ ████ █  █ █  █ ███  ████",
].join("\n");

/** A lemonade stand, for the splash screen. Every row is 28 columns. */
export const STAND = [
  "      ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄      ",
  "      █ LEMONADE  5¢ █      ",
  "      ▀▀▀▀▀▀▀┬┬▀▀▀▀▀▀▀      ",
  "             ││             ",
  "   ▄▄▄▄▄▄▄▄▄▄┴┴▄▄▄▄▄▄▄▄▄▄   ",
  "   ██████████████████████   ",
].join("\n");

/**
 * Every row is 21 columns.
 *
 * The outer rays use the same box-drawing diagonals as the inner ones. They
 * were briefly U+244A and U+2AFD, which no monospace font in common use
 * carries, so browsers substituted another face for those two cells and the
 * mismatched advance width skewed the whole figure.
 */
export const SUN = [
  "     ╲ ▄▄▄▄▄▄▄ ╱     ",
  "    ╲ ▟███████▙ ╱    ",
  "   ── █████████ ──   ",
  "    ╱ ▜███████▛ ╲    ",
  "     ╱ ▀▀▀▀▀▀▀ ╲     ",
].join("\n");

/** Every row is 21 columns. */
export const RAIN = [
  "    ▄▄███▄▄████▄▄    ",
  "  ██████████████████ ",
  "  ▀▀█▀▀██▀▀▀███▀█▀▀  ",
  "    ╱  ╱  ╱  ╱  ╱    ",
  "      ╱  ╱  ╱  ╱     ",
].join("\n");


export const SUNNY_MESSAGE =
  "Ahhhh, a bright and sunny day! The cash should just be rolling in today!";

export const RAIN_MESSAGE = "People drinking lemonade in the rain: 0, ever.";

export function eventMessage(ingredient: string): string {
  return `Oh no! The price of ${ingredient} has gone up! That's going to raise your costs!!`;
}

export const INGREDIENT_NAMES = {
  sugar: "SUGAR",
  lemons: "LEMONS",
  cups: "PAPER CUPS",
} as const;
