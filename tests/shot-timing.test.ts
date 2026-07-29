import { describe, expect, it } from "vitest";

import { airburstFlightTimings } from "../app/game/shot-timing";
import type {
  AirburstFallTrajectory,
  TrajectoryPoint,
} from "../lib/game";

function trajectory(
  index: number,
  duration: number,
): AirburstFallTrajectory {
  const point = (time: number): TrajectoryPoint => ({
    x: time * (index + 1),
    y: time * time,
    time,
    velocityX: index + 1,
    velocityY: time * 2,
  });

  return {
    index,
    horizontalVelocityOffset: index * 4,
    points: [point(0), point(duration / 2), point(duration)],
  };
}

describe("airburst presentation timing", () => {
  it("uses each child's physical duration on one shared clock", () => {
    const timings = airburstFlightTimings([
      trajectory(0, 1),
      trajectory(1, 2),
      trajectory(2, 4),
    ]);

    expect(timings.map(({ startsAt }) => startsAt)).toEqual([
      0.41, 0.41, 0.41,
    ]);
    [0.4975, 0.585, 0.76].forEach((expected, index) => {
      expect(timings[index]?.endsAt).toBeCloseTo(expected, 10);
    });
    timings.forEach(({ impactAt, endsAt }) => {
      expect(impactAt - endsAt).toBeCloseTo(0.01, 10);
    });
    expect(Object.isFrozen(timings)).toBe(true);
    expect(timings.every((timing) => Object.isFrozen(timing))).toBe(true);
  });
});
