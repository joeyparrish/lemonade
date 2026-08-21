/*
 * Block art, drawn for this project in the style of the original's screens
 * rather than copied from them. Everything here is 39 columns or narrower so
 * it fits a narrow phone viewport without scrolling.
 */

/** The word LEMONADE in 5 row block capitals, 39 columns wide. */
export const TITLE = [
  "█    ████ █  █ ████ █  █ ████ ███  ████",
  "█    █    ████ █  █ ██ █ █  █ █  █ █   ",
  "█    ███  ████ █  █ █ ██ ████ █  █ ███ ",
  "█    █    █  █ █  █ █  █ █  █ █  █ █   ",
  "████ ████ █  █ ████ █  █ █  █ ███  ████",
].join("\n");

/** A lemonade stand, for the splash screen. */
export const STAND = [
  "      ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄      ",
  "      █ LEMONADE  5¢ █      ",
  "      ▀▀▀▀▀▀▀┬┬▀▀▀▀▀▀▀      ",
  "             ││             ",
  "     ▄▄▄▄▄▄▄▄┴┴▄▄▄▄▄▄▄▄     ",
  "     ████████████████████     ",
].join("\n");

export const SUN = [
  "     \\   ▄▄▄▄▄   /     ",
  "      ▄███████▄       ",
  "   ─ █████████ ─   ",
  "      ▀███████▀       ",
  "     /   ▀▀▀▀▀   \\     ",
].join("\n");

export const RAIN = [
  "    ▄▄▄▄▄▄▄▄▄▄▄▄▄     ",
  "  ▄███████████████▄   ",
  "  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀   ",
  "    ╱  ╱  ╱  ╱  ╱     ",
  "   ╱  ╱  ╱  ╱  ╱      ",
].join("\n");

/*
 * The three strings below are verbatim from the original game's screens, kept
 * at the owner's request for this private build. They are the only copied text
 * in the project; everything else is written for it. If this ever goes public,
 * reword these.
 */
export const SUNNY_MESSAGE =
  "Ahhhh, a bright and sunny day! Profits should roll in if you decided to make your lemonade!";

export const RAIN_MESSAGE = "No customers with this rain!";

export function eventMessage(ingredient: string): string {
  return `Oh No! The price of ${ingredient} has gone up! It's now going to cost you more to make a glass of lemonade!!`;
}

export const INGREDIENT_NAMES = {
  sugar: "SUGAR",
  lemons: "LEMONS",
  cups: "PAPER CUPS",
} as const;
