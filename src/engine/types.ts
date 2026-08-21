export type NewsEvent = "sugar" | "lemons" | "cups";

export interface Weather {
  /** Degrees Fahrenheit, always 71 to 105 inclusive. */
  temperatureF: number;
  /** Percent, 0 to 100. Zero means the day is guaranteed dry. */
  chanceOfRain: number;
}

export interface Decision {
  glassesMade: number;
  priceCents: number;
}

/**
 * Demand coefficients in hundredths, one per temperature band, ordered to
 * match TEMPERATURE_BAND_EDGES.
 */
export type Coefficients = readonly [number, number, number, number];

export interface DayOutcome {
  day: number;
  weather: Weather;
  rained: boolean;
  event: NewsEvent | null;
  costPerGlassCents: number;
  glassesMade: number;
  /**
   * What the player charged. Recorded rather than derived, because on a rained
   * out day both sales and glasses sold are zero and the price is unrecoverable.
   */
  priceCents: number;
  glassesSold: number;
  totalCostCents: number;
  totalSalesCents: number;
  profitCents: number;
  cashCents: number;
}

export interface GameState {
  seed: number;
  /** 1-based index of the day awaiting a decision. */
  day: number;
  cashCents: number;
  costPerGlassCents: number;
  /**
   * Carried across days because a price of exactly 126 cents matches no band
   * and leaves these untouched, exactly as the original does. These are the
   * post-jitter values, matching the original, where the daily jitter is added
   * into the same variables the price band wrote.
   */
  coefficients: Coefficients;
  pendingWeather: Weather;
  pendingEvent: NewsEvent | null;
  history: DayOutcome[];
  finished: boolean;
}
