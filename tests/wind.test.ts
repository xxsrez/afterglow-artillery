import { describe, expect, it } from "vitest";

import {
  WIND_CALIBRATION,
  advanceWindAfterShot,
  createWindSnapshot,
  transitionWindState,
  type WindSnapshot,
  type WindRules,
} from "../lib/game";

const QUICK_DEMO_WIND: WindRules = {
  maxWind: 90,
  changingWind: true,
};

function sequence(
  seed: number,
  length: number,
  rules = QUICK_DEMO_WIND,
): readonly WindSnapshot[] {
  const snapshots: WindSnapshot[] = [createWindSnapshot(seed, rules)];

  while (snapshots.length < length) {
    snapshots.push(
      advanceWindAfterShot(
        snapshots.at(-1) as WindSnapshot,
        seed,
        rules,
      ),
    );
  }

  return snapshots;
}

function lagOneAutocorrelation(
  pairs: readonly (readonly [number, number])[],
): number {
  const previousMean =
    pairs.reduce((sum, [previous]) => sum + previous, 0) / pairs.length;
  const nextMean =
    pairs.reduce((sum, [, next]) => sum + next, 0) / pairs.length;
  let covariance = 0;
  let previousVariance = 0;
  let nextVariance = 0;

  for (const [previous, next] of pairs) {
    covariance += (previous - previousMean) * (next - nextMean);
    previousVariance += (previous - previousMean) ** 2;
    nextVariance += (next - nextMean) ** 2;
  }

  return covariance / Math.sqrt(previousVariance * nextVariance);
}

describe("mean-reverting wind domain", () => {
  it("replays the same six-turn calm crossing and differs for another seed", () => {
    const first = sequence(41_705, 6).map(({ wind }) => wind);
    const replay = sequence(41_705, 6).map(({ wind }) => wind);
    const other = sequence(41_706, 6).map(({ wind }) => wind);

    expect(first).toEqual([-70, -64, -49, -22, 5, 32]);
    expect(replay).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it("pulls symmetrically toward calm when gust and trend are zero", () => {
    const positive = transitionWindState(
      { value: 0.6, velocity: 0 },
      0,
    ).state;
    const negative = transitionWindState(
      { value: -0.6, velocity: 0 },
      0,
    ).state;

    expect(positive.velocity).toBeCloseTo(-0.108, 12);
    expect(positive.value).toBeLessThan(0.6);
    expect(negative.velocity).toBeCloseTo(0.108, 12);
    expect(negative.value).toBe(-positive.value);
  });

  it("reflects and damps an outward trend instead of sticking to a boundary", () => {
    const transition = transitionWindState(
      { value: 0.95, velocity: 0.31 },
      0.27,
    );

    expect(transition.reflected).toBe(true);
    expect(transition.state.value).toBeLessThan(1);
    expect(transition.state.velocity).toBeLessThan(0);
    expect(Math.abs(transition.state.velocity)).toBeLessThan(0.31);
  });

  it("changes visible wind exactly once per completed-shot boundary", () => {
    const duringShot = createWindSnapshot(41_705, QUICK_DEMO_WIND);
    const simulationWind = duringShot.wind;
    const nextAiming = advanceWindAfterShot(
      duringShot,
      41_705,
      QUICK_DEMO_WIND,
    );

    expect(duringShot.transition).toBe(0);
    expect(duringShot.wind).toBe(simulationWind);
    expect(nextAiming.transition).toBe(1);
    expect(nextAiming.wind).not.toBe(simulationWind);

    const quickDemo = sequence(99, 20).map(({ wind }) => wind);
    const infiniteArsenal = sequence(99, 20).map(({ wind }) => wind);
    expect(infiniteArsenal).toEqual(quickDemo);
  });

  it("keeps zero or disabled wind fixed across completed shots", () => {
    const disabledRules = { maxWind: 90, changingWind: false } as const;
    const zeroRules = { maxWind: 0, changingWind: true } as const;
    const disabled = sequence(7, 8, disabledRules);
    const zero = sequence(7, 8, zeroRules);

    expect(new Set(disabled.map(({ wind }) => wind))).toHaveLength(1);
    expect(new Set(zero.map(({ wind }) => wind))).toEqual(new Set([0]));
    expect(disabled.at(-1)?.transition).toBe(7);
    expect(zero.at(-1)?.transition).toBe(7);
  });

  it("meets the fixed 10,000-seed calibration envelope", () => {
    const seedCount = 10_000;
    const sequenceLength = 40;
    const calmThreshold = QUICK_DEMO_WIND.maxWind * 0.1;
    const pairs: Array<readonly [number, number]> = [];
    const sideRunLengths: number[] = [];
    let sum = 0;
    let stateCount = 0;
    let sequencesWithBothDirections = 0;
    let boundaryStates = 0;

    for (let seed = 0; seed < seedCount; seed += 1) {
      const snapshots = sequence(seed, sequenceLength);
      const winds = snapshots.map(({ wind }) => wind);
      let side: -1 | 0 | 1 = 0;
      let sideRun = 0;

      if (
        winds.slice(0, 16).some((wind) => wind < 0) &&
        winds.slice(0, 16).some((wind) => wind > 0)
      ) {
        sequencesWithBothDirections += 1;
      }

      for (let index = 0; index < winds.length; index += 1) {
        const wind = winds[index] as number;
        const previous = winds[index - 1];
        sum += wind;
        stateCount += 1;
        if (Math.abs(wind) === QUICK_DEMO_WIND.maxWind) {
          boundaryStates += 1;
        }

        if (previous !== undefined) {
          const delta = Math.abs(wind - previous);
          expect(delta).toBeGreaterThanOrEqual(1);
          expect(delta).toBeLessThanOrEqual(
            Math.floor(
              WIND_CALIBRATION.maxVelocity * QUICK_DEMO_WIND.maxWind,
            ),
          );
          pairs.push([previous, wind]);
        }

        const nextSide =
          wind > calmThreshold ? 1 : wind < -calmThreshold ? -1 : 0;
        if (nextSide === 0) {
          if (sideRun > 0) {
            sideRunLengths.push(sideRun);
          }
          side = 0;
          sideRun = 0;
        } else if (nextSide === side) {
          sideRun += 1;
        } else {
          if (sideRun > 0) {
            sideRunLengths.push(sideRun);
          }
          side = nextSide;
          sideRun = 1;
        }
      }

      if (sideRun > 0) {
        sideRunLengths.push(sideRun);
      }
    }

    sideRunLengths.sort((left, right) => left - right);
    const medianSideRun =
      sideRunLengths[Math.floor(sideRunLengths.length / 2)] as number;
    const mean = sum / stateCount;
    const autocorrelation = lagOneAutocorrelation(pairs);
    const bothDirectionsShare = sequencesWithBothDirections / seedCount;
    const boundaryShare = boundaryStates / stateCount;

    expect(Math.abs(mean)).toBeLessThanOrEqual(
      QUICK_DEMO_WIND.maxWind * 0.03,
    );
    expect(autocorrelation).toBeGreaterThanOrEqual(0.75);
    expect(autocorrelation).toBeLessThanOrEqual(0.95);
    expect(medianSideRun).toBeGreaterThanOrEqual(4);
    expect(medianSideRun).toBeLessThanOrEqual(8);
    expect(bothDirectionsShare).toBeGreaterThanOrEqual(0.9);
    expect(boundaryShare).toBeLessThan(0.01);
  }, 15_000);
});
