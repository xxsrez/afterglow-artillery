import type {
  AirburstFallTrajectory,
  TrajectoryPoint,
} from "@/lib/game";

export interface FlightSegmentTiming {
  readonly startsAt: number;
  readonly endsAt: number;
  readonly impactAt: number;
}

function trajectoryDuration(points: readonly TrajectoryPoint[]): number {
  return points[points.length - 1]?.time ?? 0;
}

/**
 * Maps fixed-step airburst paths into one shared presentation clock.
 * A shorter path ends earlier instead of being stretched across the longest
 * child's interval, so equal local progress still means equal ballistic time.
 */
export function airburstFlightTimings(
  trajectories: readonly AirburstFallTrajectory[],
  startsAt = 0.41,
  window = 0.35,
): readonly FlightSegmentTiming[] {
  const longestFallTime = Math.max(
    ...trajectories.map(({ points }) => trajectoryDuration(points)),
    1 / 60,
  );

  return Object.freeze(
    trajectories.map(({ points }) => {
      const endsAt =
        startsAt + window * (trajectoryDuration(points) / longestFallTime);
      return Object.freeze({
        startsAt,
        endsAt,
        impactAt: endsAt + 0.01,
      });
    }),
  );
}
