import {
  MAX_GLASSES_PER_DAY,
  MAX_PRICE_CENTS,
  RUN_LENGTH_DAYS,
  STARTING_CASH_CENTS,
  STARTING_COST_CENTS,
} from "./constants";
import { rollNewsEvent } from "./cost";
import {
  applyJitter,
  glassesSold as computeGlassesSold,
  selectCoefficients,
  temperatureBandIndex,
} from "./demand";
import { createRng } from "./rng";
import { generateWeather, resolveRain } from "./weather";
import type { Coefficients, Decision, DayOutcome, GameState } from "./types";

const INITIAL_COEFFICIENTS: Coefficients = [0, 0, 0, 0];

/**
 * Two independent generators per day, both derived from the run seed. Keeps
 * GameState plain serializable data instead of carrying live generator state,
 * so a saved game is just JSON and advanceDay stays a pure function.
 *
 * They are separate on purpose. Setup draws (the news event and the weather)
 * happen when the previous day ends, and resolution draws (rain and jitter)
 * happen when the player commits. A single shared stream would force
 * advanceDay to replay the setup draws just to reach the right position, and
 * that replay would silently desynchronise the moment rollNewsEvent stops
 * drawing at the cost ceiling.
 */
function setupRngFor(seed: number, day: number) {
  return createRng((seed ^ (day * 0x9e3779b1)) >>> 0);
}

function resolveRngFor(seed: number, day: number) {
  return createRng((seed ^ (day * 0x85ebca6b) ^ 0x5bf03635) >>> 0);
}

export function startRun(seed: number): GameState {
  const setup = setupRngFor(seed, 1);
  const { costPerGlassCents, event } = rollNewsEvent(STARTING_COST_CENTS, setup);
  return {
    seed,
    day: 1,
    cashCents: STARTING_CASH_CENTS,
    costPerGlassCents,
    coefficients: INITIAL_COEFFICIENTS,
    pendingWeather: generateWeather(setup),
    pendingEvent: event,
    history: [],
    finished: false,
  };
}

export function maxAffordableGlasses(state: GameState): number {
  const affordable = Math.floor(state.cashCents / state.costPerGlassCents);
  return Math.max(0, Math.min(affordable, MAX_GLASSES_PER_DAY));
}

export function validateDecision(
  state: GameState,
  decision: Decision,
): string | null {
  const { glassesMade, priceCents } = decision;
  if (!Number.isInteger(glassesMade) || glassesMade < 0) {
    return "Glasses must be a whole number, zero or more.";
  }
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    return "Price must be a whole number of cents, zero or more.";
  }
  if (glassesMade > maxAffordableGlasses(state)) {
    return `You can only afford ${maxAffordableGlasses(state)} glasses.`;
  }
  if (priceCents > MAX_PRICE_CENTS) {
    return `Price cannot exceed ${MAX_PRICE_CENTS} cents.`;
  }
  return null;
}

export function advanceDay(state: GameState, decision: Decision): GameState {
  if (state.finished) return state;

  const rng = resolveRngFor(state.seed, state.day);
  const weather = state.pendingWeather;
  const rained = resolveRain(weather.chanceOfRain, rng);

  const base = selectCoefficients(state.coefficients, decision.priceCents);
  const coefficients = applyJitter(base, decision.priceCents, rng);
  const band = temperatureBandIndex(weather.temperatureF);
  const sold = rained
    ? 0
    : computeGlassesSold(decision.glassesMade, coefficients[band]!);

  const totalCostCents = decision.glassesMade * state.costPerGlassCents;
  const totalSalesCents = sold * decision.priceCents;
  const profitCents = totalSalesCents - totalCostCents;
  const cashCents = state.cashCents + profitCents;

  const outcome: DayOutcome = {
    day: state.day,
    weather,
    rained,
    event: state.pendingEvent,
    costPerGlassCents: state.costPerGlassCents,
    glassesMade: decision.glassesMade,
    glassesSold: sold,
    totalCostCents,
    totalSalesCents,
    profitCents,
    cashCents,
  };

  const nextDay = state.day + 1;
  const seasonOver = nextDay > RUN_LENGTH_DAYS;
  const setup = setupRngFor(state.seed, nextDay);
  const nextCost = rollNewsEvent(state.costPerGlassCents, setup);
  /*
   * Deliberate addition, not recovered behaviour. Once cash will not cover a
   * single glass the player can only sit through zero-glass days that can
   * never earn anything back, so the run ends instead. What the original did
   * in this situation was not established.
   */
  const bankrupt = !seasonOver && cashCents < nextCost.costPerGlassCents;
  const finished = seasonOver || bankrupt;

  return {
    ...state,
    day: nextDay,
    cashCents,
    costPerGlassCents: finished
      ? state.costPerGlassCents
      : nextCost.costPerGlassCents,
    // The persisted coefficients are the jittered ones, not `base`. The
    // original adds the jitter into the same variables the price band wrote,
    // so at the 126 cent gap it is the previous day's jittered values that
    // survive, and today's jitter stacks on top of them.
    coefficients,
    pendingWeather: finished ? weather : generateWeather(setup),
    pendingEvent: finished ? null : nextCost.event,
    history: [...state.history, outcome],
    finished,
  };
}

export function finalScoreCents(state: GameState): number {
  return state.cashCents;
}

/** True when the run ended early because the player could not afford a glass. */
export function wentBust(state: GameState): boolean {
  return state.finished && state.history.length < RUN_LENGTH_DAYS;
}
