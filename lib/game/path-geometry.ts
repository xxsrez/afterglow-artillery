import type { Vector2 } from "./types";

interface MutableVector2 {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Interpolates along a sampled path by point index. Empty paths deliberately
 * return null so callers must choose a meaningful fallback.
 */
export function pointAlongPath(
  path: readonly Vector2[],
  progress: number,
): Vector2 | null {
  const point: MutableVector2 = { x: 0, y: 0 };
  return pointAlongPathInto(path, progress, point) ? point : null;
}

/**
 * Allocation-free form for render loops. Returns false for an empty path and
 * leaves `out` untouched in that case.
 */
export function pointAlongPathInto(
  path: readonly Vector2[],
  progress: number,
  out: MutableVector2,
): boolean {
  if (path.length === 0) {
    return false;
  }

  if (path.length === 1) {
    const only = path[0] as Vector2;
    out.x = only.x;
    out.y = only.y;
    return true;
  }

  const exactIndex = clamp(progress, 0, 1) * (path.length - 1);
  const low = Math.floor(exactIndex);
  const high = Math.min(path.length - 1, low + 1);
  const local = exactIndex - low;
  const start = path[low] as Vector2;
  const end = path[high] as Vector2;

  out.x = start.x + (end.x - start.x) * local;
  out.y = start.y + (end.y - start.y) * local;
  return true;
}

/**
 * Bounds long simulation paths while preserving both endpoints and order.
 */
export function samplePath(
  points: readonly Vector2[],
  maxPoints = 150,
): readonly Vector2[] {
  if (!Number.isInteger(maxPoints) || maxPoints < 1) {
    throw new RangeError("maxPoints must be a positive integer");
  }
  if (points.length <= maxPoints) {
    return points;
  }
  if (maxPoints === 1) {
    return [points[0] as Vector2];
  }

  const sampled: Vector2[] = [];
  const stride = (points.length - 1) / (maxPoints - 1);

  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round(index * stride)] as Vector2);
  }

  return sampled;
}

export function linePath(
  start: Vector2,
  end: Vector2,
  pointCount = 48,
): readonly Vector2[] {
  if (!Number.isInteger(pointCount) || pointCount < 1) {
    throw new RangeError("pointCount must be a positive integer");
  }

  const points: Vector2[] = [];
  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / Math.max(1, pointCount - 1);
    points.push({
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    });
  }
  return points;
}
