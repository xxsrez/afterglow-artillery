import {
  DEFAULT_GRAVITY,
  DEFAULT_MAX_SHOT_TIME,
  DEFAULT_POWER_SCALE,
  DEFAULT_TIME_STEP,
} from "./constants";
import { circleIntersectsCell, type TerrainGrid } from "./terrain";
import type { ShotDirection, Vector2 } from "./types";

export interface TrajectoryOptions {
  readonly origin: Vector2;
  /** 0 is horizontal, 90 is straight up. */
  readonly angleDegrees: number;
  /** Player-facing 0–1000 power scale by default. */
  readonly power: number;
  readonly direction?: ShotDirection;
  /** Horizontal acceleration in logical units per second squared. */
  readonly wind?: number;
  /** Downward acceleration in logical units per second squared. */
  readonly gravity?: number;
  readonly powerScale?: number;
  readonly timeStep?: number;
  readonly maxTime?: number;
  readonly projectileRadius?: number;
}

export interface TrajectoryPoint extends Vector2 {
  readonly time: number;
  readonly velocityX: number;
  readonly velocityY: number;
}

export interface TrajectoryCollision {
  readonly type: "terrain" | "bounds";
  readonly position: Vector2;
  readonly time: number;
  readonly cell:
    | {
        readonly x: number;
        readonly y: number;
      }
    | null;
}

export type TrajectoryEndReason = "terrain" | "bounds" | "max-time";

export interface TrajectoryResult {
  readonly points: readonly TrajectoryPoint[];
  readonly collision: TrajectoryCollision | null;
  readonly reason: TrajectoryEndReason;
}

interface SegmentHit {
  readonly type: "terrain" | "bounds";
  readonly position: Vector2;
  readonly fraction: number;
  readonly cell: { readonly x: number; readonly y: number } | null;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

function circleTouchesTerrain(
  terrain: TerrainGrid,
  centerX: number,
  centerY: number,
  radius: number,
): { readonly x: number; readonly y: number } | null {
  if (radius <= 0) {
    if (!terrain.isSolid(centerX, centerY)) {
      return null;
    }

    return { x: Math.floor(centerX), y: Math.floor(centerY) };
  }

  const minX = Math.floor(centerX - radius);
  const maxX = Math.ceil(centerX + radius);
  const minY = Math.floor(centerY - radius);
  const maxY = Math.ceil(centerY + radius);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (
        circleIntersectsCell(centerX, centerY, radius, x, y) &&
        terrain.isSolid(x, y)
      ) {
        return { x, y };
      }
    }
  }

  return null;
}

/**
 * Sweeps a projectile between two fixed-step positions. Sampling at half-cell
 * intervals prevents fast shots from tunnelling through one-cell terrain.
 */
export function findTerrainIntersection(
  terrain: TerrainGrid,
  from: Vector2,
  to: Vector2,
  projectileRadius = 0,
): SegmentHit | null {
  if (!Number.isFinite(projectileRadius) || projectileRadius < 0) {
    throw new RangeError(
      "Projectile radius must be a finite non-negative number.",
    );
  }

  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaY)) * 2),
  );

  for (let step = 0; step <= steps; step += 1) {
    const fraction = step / steps;
    const x = from.x + deltaX * fraction;
    const y = from.y + deltaY * fraction;

    if (x + projectileRadius < 0 || x - projectileRadius >= terrain.width) {
      return {
        type: "bounds",
        position: { x, y },
        fraction,
        cell: null,
      };
    }

    if (y - projectileRadius >= terrain.height) {
      return {
        type: "bounds",
        position: { x, y },
        fraction,
        cell: null,
      };
    }

    const cell = circleTouchesTerrain(
      terrain,
      x,
      y,
      projectileRadius,
    );
    if (cell !== null) {
      return {
        type: "terrain",
        position: { x, y },
        fraction,
        cell,
      };
    }
  }

  return null;
}

/**
 * Calculates a deterministic, non-mutating ballistic trace at a fixed step.
 * X acceleration is wind; Y acceleration is gravity. The top of the world is
 * open so high arcs can temporarily leave the visible viewport.
 */
export function simulateTrajectory(
  terrain: TerrainGrid,
  options: TrajectoryOptions,
): TrajectoryResult {
  const direction = options.direction ?? 1;
  const wind = options.wind ?? 0;
  const gravity = options.gravity ?? DEFAULT_GRAVITY;
  const powerScale = options.powerScale ?? DEFAULT_POWER_SCALE;
  const timeStep = options.timeStep ?? DEFAULT_TIME_STEP;
  const maxTime = options.maxTime ?? DEFAULT_MAX_SHOT_TIME;
  const projectileRadius = options.projectileRadius ?? 0;

  assertFinite(options.origin.x, "Origin X");
  assertFinite(options.origin.y, "Origin Y");
  assertFinite(options.angleDegrees, "Angle");
  assertFinite(options.power, "Power");
  assertFinite(wind, "Wind");
  assertFinite(gravity, "Gravity");
  assertFinite(powerScale, "Power scale");

  if (direction !== -1 && direction !== 1) {
    throw new RangeError("Direction must be -1 or 1.");
  }

  if (options.angleDegrees < 0 || options.angleDegrees > 90) {
    throw new RangeError("Angle must be between 0 and 90 degrees.");
  }

  if (options.power < 0 || powerScale < 0) {
    throw new RangeError("Power and power scale cannot be negative.");
  }

  if (!Number.isFinite(timeStep) || timeStep <= 0) {
    throw new RangeError("Time step must be a finite positive number.");
  }

  if (!Number.isFinite(maxTime) || maxTime <= 0) {
    throw new RangeError("Max time must be a finite positive number.");
  }

  if (!Number.isFinite(projectileRadius) || projectileRadius < 0) {
    throw new RangeError(
      "Projectile radius must be a finite non-negative number.",
    );
  }

  const radians = (options.angleDegrees * Math.PI) / 180;
  const speed = options.power * powerScale;
  const launchVelocityX = Math.cos(radians) * speed * direction;
  const launchVelocityY = -Math.sin(radians) * speed;
  const points: TrajectoryPoint[] = [
    {
      x: options.origin.x,
      y: options.origin.y,
      time: 0,
      velocityX: launchVelocityX,
      velocityY: launchVelocityY,
    },
  ];

  const initialCell = circleTouchesTerrain(
    terrain,
    options.origin.x,
    options.origin.y,
    projectileRadius,
  );
  if (initialCell !== null) {
    return {
      points,
      reason: "terrain",
      collision: {
        type: "terrain",
        position: { ...options.origin },
        time: 0,
        cell: initialCell,
      },
    };
  }

  const maxSteps = Math.ceil(maxTime / timeStep);
  let previousPoint = points[0] as TrajectoryPoint;

  for (let step = 1; step <= maxSteps; step += 1) {
    const time = Math.min(step * timeStep, maxTime);
    const currentPoint: TrajectoryPoint = {
      x:
        options.origin.x +
        launchVelocityX * time +
        0.5 * wind * time * time,
      y:
        options.origin.y +
        launchVelocityY * time +
        0.5 * gravity * time * time,
      time,
      velocityX: launchVelocityX + wind * time,
      velocityY: launchVelocityY + gravity * time,
    };
    const hit = findTerrainIntersection(
      terrain,
      previousPoint,
      currentPoint,
      projectileRadius,
    );

    if (hit !== null) {
      const collisionTime =
        previousPoint.time +
        (currentPoint.time - previousPoint.time) * hit.fraction;
      const collisionPoint: TrajectoryPoint = {
        x: hit.position.x,
        y: hit.position.y,
        time: collisionTime,
        velocityX: launchVelocityX + wind * collisionTime,
        velocityY: launchVelocityY + gravity * collisionTime,
      };
      points.push(collisionPoint);

      return {
        points,
        reason: hit.type,
        collision: {
          type: hit.type,
          position: hit.position,
          time: collisionTime,
          cell: hit.cell,
        },
      };
    }

    points.push(currentPoint);
    previousPoint = currentPoint;

    if (time >= maxTime) {
      break;
    }
  }

  return {
    points,
    collision: null,
    reason: "max-time",
  };
}
