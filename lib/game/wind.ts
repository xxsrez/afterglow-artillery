import { SeededRandom, type RandomSeed } from "./random";

export interface WindState {
  /** Current wind normalized to the inclusive range [-1, 1]. */
  readonly value: number;
  /** Current normalized per-shot trend. */
  readonly velocity: number;
}

export interface WindRules {
  /** Maximum visible wind magnitude in ruleset units. */
  readonly maxWind: number;
  /** Whether a completed shot advances the wind model. */
  readonly changingWind: boolean;
}

export interface WindSnapshot {
  readonly state: WindState;
  /** Integer value shared by the HUD and ballistic simulation. */
  readonly wind: number;
  /** Number of completed-shot boundaries already consumed. */
  readonly transition: number;
}

export interface WindStateTransition {
  readonly state: WindState;
  readonly reflected: boolean;
}

export const WIND_CALIBRATION = {
  inertia: 0.65,
  meanReversion: 0.18,
  gustScale: 0.27,
  maxVelocity: 0.31,
  reflectionDamping: 0.55,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function assertRules(rules: WindRules): void {
  if (
    !Number.isSafeInteger(rules.maxWind) ||
    rules.maxWind < 0
  ) {
    throw new RangeError("maxWind must be a non-negative safe integer.");
  }
}

function normalizeState(state: WindState): WindState {
  if (
    !Number.isFinite(state.value) ||
    !Number.isFinite(state.velocity)
  ) {
    throw new RangeError("Wind state values must be finite.");
  }

  return {
    value: clamp(state.value, -1, 1),
    velocity: clamp(
      state.velocity,
      -WIND_CALIBRATION.maxVelocity,
      WIND_CALIBRATION.maxVelocity,
    ),
  };
}

/**
 * Applies one continuous oscillator step for an already sampled normalized
 * gust. Keeping this operation separate makes the spring and reflection rules
 * directly testable without introducing another source of randomness.
 */
export function transitionWindState(
  current: WindState,
  gust: number,
): WindStateTransition {
  if (!Number.isFinite(gust)) {
    throw new RangeError("Wind gust must be finite.");
  }

  const state = normalizeState(current);
  let velocity = clamp(
    WIND_CALIBRATION.inertia * state.velocity -
      WIND_CALIBRATION.meanReversion * state.value +
      gust,
    -WIND_CALIBRATION.maxVelocity,
    WIND_CALIBRATION.maxVelocity,
  );
  let value = state.value + velocity;
  let reflected = false;

  if (value > 1) {
    value = 2 - value;
    velocity = -velocity * WIND_CALIBRATION.reflectionDamping;
    reflected = true;
  } else if (value < -1) {
    value = -2 - value;
    velocity = -velocity * WIND_CALIBRATION.reflectionDamping;
    reflected = true;
  }

  return {
    state: {
      value: clamp(value, -1, 1),
      velocity,
    },
    reflected,
  };
}

function gustForTransition(
  seed: RandomSeed,
  transition: number,
): number {
  const random = new SeededRandom(
    `${seed}:wind:transition:${transition}`,
  );

  return WIND_CALIBRATION.gustScale * (random.next() - random.next());
}

function visibleWind(value: number, maxWind: number): number {
  return Math.round(clamp(value, -1, 1) * maxWind);
}

export function createWindSnapshot(
  seed: RandomSeed,
  rules: WindRules,
): WindSnapshot {
  assertRules(rules);

  if (rules.maxWind === 0) {
    return {
      state: { value: 0, velocity: 0 },
      wind: 0,
      transition: 0,
    };
  }

  const random = new SeededRandom(`${seed}:wind:initial`);
  const wind = visibleWind(random.float(-1, 1), rules.maxWind);

  return {
    state: {
      value: wind / rules.maxWind,
      velocity: 0,
    },
    wind,
    transition: 0,
  };
}

/**
 * Advances the dedicated wind stream exactly once at a completed-shot
 * boundary. Quantizing the normalized state here guarantees that the HUD and
 * trajectory receive the same value.
 */
export function advanceWindAfterShot(
  current: WindSnapshot,
  seed: RandomSeed,
  rules: WindRules,
): WindSnapshot {
  assertRules(rules);

  const nextTransition = current.transition + 1;
  if (!rules.changingWind) {
    return { ...current, transition: nextTransition };
  }
  if (rules.maxWind === 0) {
    return {
      state: { value: 0, velocity: 0 },
      wind: 0,
      transition: nextTransition,
    };
  }

  const gust = gustForTransition(seed, current.transition);
  const continuous = transitionWindState(current.state, gust);
  const maximumVisibleDelta = Math.max(
    1,
    Math.floor(WIND_CALIBRATION.maxVelocity * rules.maxWind),
  );
  let wind = clamp(
    visibleWind(continuous.state.value, rules.maxWind),
    current.wind - maximumVisibleDelta,
    current.wind + maximumVisibleDelta,
  );

  if (wind === current.wind) {
    let direction =
      Math.sign(continuous.state.velocity) ||
      Math.sign(-current.state.value) ||
      Math.sign(continuous.state.value - current.state.value) ||
      1;
    if (
      current.wind + direction > rules.maxWind ||
      current.wind + direction < -rules.maxWind
    ) {
      direction *= -1;
    }
    wind += direction;
  }

  wind = clamp(wind, -rules.maxWind, rules.maxWind);

  return {
    state: {
      value: wind / rules.maxWind,
      velocity: continuous.state.velocity,
    },
    wind,
    transition: nextTransition,
  };
}
