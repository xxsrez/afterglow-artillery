import { SeededRandom } from "./random";
import { TerrainGrid } from "./terrain";
import {
  simulateTrajectoryFromVelocity,
  type TrajectoryPoint,
} from "./ballistics";
import {
  airburstPayloadProfile,
  type AirburstPayloadWeaponId,
} from "./payload-profiles";
import type { Vector2 } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function terrainSurfaceOrFloor(
  terrain: TerrainGrid,
  x: number,
): number {
  return terrain.surfaceY(x) ?? terrain.height - 26;
}

export function buildRollPath(
  terrain: TerrainGrid,
  impact: Vector2,
): readonly Vector2[] {
  const leftSurface = terrainSurfaceOrFloor(terrain, impact.x - 8);
  const rightSurface = terrainSurfaceOrFloor(terrain, impact.x + 8);
  let direction = rightSurface >= leftSurface ? 1 : -1;
  let x = clamp(impact.x, 3, terrain.width - 3);
  let previousY = terrainSurfaceOrFloor(terrain, x) - 4;
  const points: Vector2[] = [{ x, y: previousY }];

  for (let step = 0; step < 55; step += 1) {
    const candidateX = clamp(x + direction * 3.2, 3, terrain.width - 3);
    const candidateY = terrainSurfaceOrFloor(terrain, candidateX) - 4;

    if (candidateY < previousY - 7) {
      direction = direction === 1 ? -1 : 1;
      continue;
    }

    x = candidateX;
    previousY = candidateY;
    points.push({ x, y: candidateY });

    const aheadY =
      terrainSurfaceOrFloor(
        terrain,
        clamp(x + direction * 6, 2, terrain.width - 2),
      ) - 4;
    if (Math.abs(aheadY - candidateY) < 1 && step > 20) {
      break;
    }
  }

  return points;
}

export function buildDiggerPath(
  terrain: TerrainGrid,
  impact: Vector2,
  velocity: Vector2,
): readonly Vector2[] {
  const length = Math.max(1, Math.hypot(velocity.x, velocity.y));
  const directionX = velocity.x / length;
  const directionY = Math.max(0.35, Math.abs(velocity.y / length));
  const points: Vector2[] = [{ ...impact }];
  let x = impact.x;
  let y = impact.y;

  for (let step = 0; step < 62; step += 1) {
    x = clamp(x + directionX * 2.25, 4, terrain.width - 4);
    y = clamp(y + directionY * 2.25, 4, terrain.height - 5);
    points.push({ x, y });
  }

  return points;
}

export function buildFlowPoints(
  terrain: TerrainGrid,
  impact: Vector2,
  halfWidth = 96,
): readonly Vector2[] {
  const points: Vector2[] = [];
  for (let offset = -halfWidth; offset <= halfWidth; offset += 12) {
    const x = clamp(impact.x + offset, 3, terrain.width - 3);
    points.push({ x, y: terrainSurfaceOrFloor(terrain, x) - 3 });
  }
  return points;
}

export function buildFunkyChain(
  terrain: TerrainGrid,
  impact: Vector2,
  count: number,
  seed: number,
): readonly Vector2[] {
  const random = new SeededRandom(`${seed}:funky:mechanics`);
  const points: Vector2[] = [{ ...impact }];
  const boundedCount = clamp(Math.round(count), 10, 14);

  for (let index = 1; index < boundedCount; index += 1) {
    const angle =
      (Math.PI * 2 * index) / boundedCount + random.float(-0.5, 0.5);
    const radius = Math.sqrt(random.float(0.05, 1)) * 76;
    points.push({
      x: clamp(impact.x + Math.cos(angle) * radius, 8, terrain.width - 8),
      y: clamp(
        impact.y + Math.sin(angle) * radius * 0.7,
        12,
        terrain.height - 8,
      ),
    });
  }

  return points;
}

export function buildUndergroundFan(
  terrain: TerrainGrid,
  impact: Vector2,
  count: number,
  tier: number,
  seed: number,
): readonly (readonly Vector2[])[] {
  const random = new SeededRandom(`${seed}:sandhog:mechanics`);
  const paths: Vector2[][] = [];
  const boundedCount = Math.max(3, Math.round(count));

  for (let warhead = 0; warhead < boundedCount; warhead += 1) {
    const fan =
      boundedCount === 1 ? 0 : warhead / Math.max(1, boundedCount - 1) - 0.5;
    const angle = Math.PI / 2 + fan * 1.25 + random.float(-0.08, 0.08);
    const length = 62 + tier * 24 + random.float(-9, 14);
    const path: Vector2[] = [];
    for (let step = 0; step <= 34; step += 1) {
      const progress = step / 34;
      const curve = Math.sin(progress * Math.PI) * fan * 18;
      path.push({
        x: clamp(
          impact.x + Math.cos(angle) * length * progress + curve,
          4,
          terrain.width - 4,
        ),
        y: clamp(
          impact.y +
            Math.sin(angle) * length * progress +
            progress * progress * 20,
          4,
          terrain.height - 5,
        ),
      });
    }
    paths.push(path);
  }

  return paths;
}

export interface AirburstFallTrajectory {
  readonly index: number;
  readonly horizontalVelocityOffset: number;
  readonly points: readonly TrajectoryPoint[];
}

/**
 * Builds the mechanical fall formation for the two apogee-splitting payloads.
 * Every child inherits the carrier's non-upward vertical velocity and receives
 * one evenly spaced horizontal offset from its family profile.
 */
export function buildAirburstFallTrajectories(
  terrain: TerrainGrid,
  apex: TrajectoryPoint,
  weaponId: AirburstPayloadWeaponId,
  wind: number,
): readonly AirburstFallTrajectory[] {
  const profile = airburstPayloadProfile(weaponId);
  const verticalVelocity = Math.max(0, apex.velocityY);

  return Object.freeze(
    Array.from({ length: profile.childCount }, (_, index) => {
      const centered = index - (profile.childCount - 1) / 2;
      const horizontalVelocityOffset =
        centered * profile.horizontalVelocityDelta;
      const trajectory = simulateTrajectoryFromVelocity(terrain, {
        origin: { x: apex.x, y: apex.y },
        velocity: {
          x: apex.velocityX + horizontalVelocityOffset,
          y: verticalVelocity,
        },
        wind,
        projectileRadius: profile.projectileRadius,
        maxTime: 7,
      }).points;

      return Object.freeze({
        index,
        horizontalVelocityOffset,
        points: trajectory,
      });
    }),
  );
}

export function trajectoryApexIndex(
  trajectory: readonly TrajectoryPoint[],
): number | null {
  const index = trajectory.findIndex(
    (point, pointIndex) => pointIndex > 1 && point.velocityY >= 0,
  );
  return index > 1 && index < trajectory.length - 1 ? index : null;
}
