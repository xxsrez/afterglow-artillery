import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { SeededRandom, type RandomSeed } from "./random";

export enum Material {
  Empty = 0,
  Soil = 1,
  Rock = 2,
}

export interface TerrainBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TerrainEdit {
  readonly changedCells: number;
  readonly bounds: TerrainBounds | null;
}

export interface SettleOptions {
  /** Maximum one-cell falling passes. */
  readonly maxPasses?: number;
  /** Hard cap on moved cells across all passes. */
  readonly maxMoves?: number;
  /** Optional region to stabilize; omitted means the whole grid. */
  readonly bounds?: TerrainBounds;
  /** Materials affected by gravity. Rock is stable by default. */
  readonly movableMaterials?: readonly Material[];
}

export interface SettleResult extends TerrainEdit {
  readonly movedCells: number;
  readonly passes: number;
  readonly stable: boolean;
}

export interface TerrainGenerationOptions {
  readonly width?: number;
  readonly height?: number;
  readonly minSurfaceY?: number;
  readonly maxSurfaceY?: number;
  readonly controlPointSpacing?: number;
  readonly roughness?: number;
  readonly caveCount?: number;
  readonly bedrockDepth?: number;
}

interface MutableBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function assertDimension(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
}

function assertRadius(radius: number): void {
  if (!Number.isFinite(radius) || radius < 0) {
    throw new RangeError("Radius must be a finite non-negative number.");
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

/**
 * Uses the same circle-vs-cell-box geometry as projectile collision so a
 * crater never leaves an invisible collidable rim around its edited area.
 */
export function circleIntersectsCell(
  centerX: number,
  centerY: number,
  radius: number,
  cellX: number,
  cellY: number,
): boolean {
  const nearestX = Math.max(cellX, Math.min(centerX, cellX + 1));
  const nearestY = Math.max(cellY, Math.min(centerY, cellY + 1));
  const deltaX = centerX - nearestX;
  const deltaY = centerY - nearestY;

  return deltaX * deltaX + deltaY * deltaY <= radius * radius;
}

function includeCell(bounds: MutableBounds | null, x: number, y: number) {
  if (bounds === null) {
    return { minX: x, minY: y, maxX: x, maxY: y };
  }

  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);

  return bounds;
}

function finalizeBounds(bounds: MutableBounds | null): TerrainBounds | null {
  if (bounds === null) {
    return null;
  }

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX + 1,
    height: bounds.maxY - bounds.minY + 1,
  };
}

/**
 * Compact logical material grid. Coordinates follow canvas convention:
 * (0, 0) is the top-left and positive Y points downward.
 */
export class TerrainGrid {
  public readonly width: number;
  public readonly height: number;
  public readonly cells: Uint8Array;

  public constructor(
    width = WORLD_WIDTH,
    height = WORLD_HEIGHT,
    cells?: Uint8Array,
  ) {
    assertDimension(width, "Terrain width");
    assertDimension(height, "Terrain height");

    const requiredLength = width * height;

    if (cells !== undefined && cells.length !== requiredLength) {
      throw new RangeError(
        `Terrain data has ${cells.length} cells; expected ${requiredLength}.`,
      );
    }

    this.width = width;
    this.height = height;
    this.cells =
      cells === undefined ? new Uint8Array(requiredLength) : cells.slice();
  }

  public clone(): TerrainGrid {
    return new TerrainGrid(this.width, this.height, this.cells);
  }

  public inBounds(x: number, y: number): boolean {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);

    return (
      cellX >= 0 &&
      cellX < this.width &&
      cellY >= 0 &&
      cellY < this.height
    );
  }

  public get(x: number, y: number): Material {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);

    if (
      cellX < 0 ||
      cellX >= this.width ||
      cellY < 0 ||
      cellY >= this.height
    ) {
      return Material.Empty;
    }

    return this.cells[this.indexOf(cellX, cellY)] as Material;
  }

  /**
   * Sets an in-bounds cell. Returns false for an out-of-bounds coordinate.
   */
  public set(x: number, y: number, material: Material): boolean {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);

    if (
      cellX < 0 ||
      cellX >= this.width ||
      cellY < 0 ||
      cellY >= this.height
    ) {
      return false;
    }

    this.cells[this.indexOf(cellX, cellY)] = material;
    return true;
  }

  public isSolid(x: number, y: number): boolean {
    return this.get(x, y) !== Material.Empty;
  }

  /**
   * Returns the first solid cell from the top, or null for an empty/outside
   * column. Internal caves therefore do not erase the playable surface.
   */
  public surfaceY(x: number): number | null {
    const cellX = Math.floor(x);

    if (cellX < 0 || cellX >= this.width) {
      return null;
    }

    for (let y = 0; y < this.height; y += 1) {
      if (this.cells[this.indexOf(cellX, y)] !== Material.Empty) {
        return y;
      }
    }

    return null;
  }

  public carveCircle(
    centerX: number,
    centerY: number,
    radius: number,
  ): TerrainEdit {
    assertRadius(radius);

    const minX = clamp(Math.floor(centerX - radius), 0, this.width - 1);
    const maxX = clamp(Math.ceil(centerX + radius), 0, this.width - 1);
    const minY = clamp(Math.floor(centerY - radius), 0, this.height - 1);
    const maxY = clamp(Math.ceil(centerY + radius), 0, this.height - 1);

    let changedCells = 0;
    let changedBounds: MutableBounds | null = null;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (
          !circleIntersectsCell(centerX, centerY, radius, x, y)
        ) {
          continue;
        }

        const index = this.indexOf(x, y);
        if (this.cells[index] === Material.Empty) {
          continue;
        }

        this.cells[index] = Material.Empty;
        changedCells += 1;
        changedBounds = includeCell(changedBounds, x, y);
      }
    }

    return {
      changedCells,
      bounds: finalizeBounds(changedBounds),
    };
  }

  public fillCircle(
    centerX: number,
    centerY: number,
    radius: number,
    material = Material.Soil,
  ): TerrainEdit {
    assertRadius(radius);

    if (material === Material.Empty) {
      throw new RangeError("fillCircle requires a solid material.");
    }

    const minX = clamp(Math.floor(centerX - radius), 0, this.width - 1);
    const maxX = clamp(Math.ceil(centerX + radius), 0, this.width - 1);
    const minY = clamp(Math.floor(centerY - radius), 0, this.height - 1);
    const maxY = clamp(Math.ceil(centerY + radius), 0, this.height - 1);

    let changedCells = 0;
    let changedBounds: MutableBounds | null = null;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (
          !circleIntersectsCell(centerX, centerY, radius, x, y)
        ) {
          continue;
        }

        const index = this.indexOf(x, y);
        if (this.cells[index] !== Material.Empty) {
          continue;
        }

        this.cells[index] = material;
        changedCells += 1;
        changedBounds = includeCell(changedBounds, x, y);
      }
    }

    return {
      changedCells,
      bounds: finalizeBounds(changedBounds),
    };
  }

  /**
   * Applies bounded, deterministic gravity to loose material. Each pass moves
   * a cell by at most one row, and both pass/move budgets prevent an expensive
   * unbounded aftermath on mobile hardware.
   */
  public settle(options: SettleOptions = {}): SettleResult {
    const maxPasses = options.maxPasses ?? 6;
    const maxMoves = options.maxMoves ?? 12_000;

    if (!Number.isInteger(maxPasses) || maxPasses < 0) {
      throw new RangeError("maxPasses must be a non-negative integer.");
    }

    if (!Number.isInteger(maxMoves) || maxMoves < 0) {
      throw new RangeError("maxMoves must be a non-negative integer.");
    }

    const requestedBounds = options.bounds ?? {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    };
    const left = clamp(Math.floor(requestedBounds.x), 0, this.width);
    const top = clamp(Math.floor(requestedBounds.y), 0, this.height);
    const right = clamp(
      Math.ceil(requestedBounds.x + requestedBounds.width),
      left,
      this.width,
    );
    const bottom = clamp(
      Math.ceil(requestedBounds.y + requestedBounds.height),
      top,
      this.height,
    );

    const movableMaterials = new Set(
      options.movableMaterials ?? [Material.Soil],
    );

    let movedCells = 0;
    let passes = 0;
    let stable = maxPasses > 0 && maxMoves > 0;
    let changedBounds: MutableBounds | null = null;

    outer: for (let pass = 0; pass < maxPasses; pass += 1) {
      passes += 1;
      let movesThisPass = 0;

      for (let y = bottom - 2; y >= top; y -= 1) {
        for (let x = left; x < right; x += 1) {
          const sourceIndex = this.indexOf(x, y);
          const material = this.cells[sourceIndex] as Material;

          if (!movableMaterials.has(material)) {
            continue;
          }

          const targetIndex = this.indexOf(x, y + 1);
          if (this.cells[targetIndex] !== Material.Empty) {
            continue;
          }

          this.cells[sourceIndex] = Material.Empty;
          this.cells[targetIndex] = material;
          movedCells += 1;
          movesThisPass += 1;
          changedBounds = includeCell(changedBounds, x, y);
          changedBounds = includeCell(changedBounds, x, y + 1);

          if (movedCells >= maxMoves) {
            stable = false;
            break outer;
          }
        }
      }

      if (movesThisPass === 0) {
        stable = true;
        break;
      }

      stable = false;
    }

    return {
      changedCells: movedCells * 2,
      movedCells,
      passes,
      stable,
      bounds: finalizeBounds(changedBounds),
    };
  }

  private indexOf(x: number, y: number): number {
    return y * this.width + x;
  }
}

/**
 * Generates a playable surface plus a small number of buried cavities. The
 * grid remains the source of truth; the interpolated height is only used at
 * generation time.
 */
export function generateTerrain(
  seed: RandomSeed,
  options: TerrainGenerationOptions = {},
): TerrainGrid {
  const width = options.width ?? WORLD_WIDTH;
  const height = options.height ?? WORLD_HEIGHT;
  assertDimension(width, "Terrain width");
  assertDimension(height, "Terrain height");

  if (width < 2 || height < 3) {
    throw new RangeError(
      "Generated terrain requires width >= 2 and height >= 3.",
    );
  }

  const defaultMinSurface = Math.round(height * 0.4);
  const defaultMaxSurface = Math.round(height * 0.7);
  const minSurfaceY = clamp(
    Math.round(options.minSurfaceY ?? defaultMinSurface),
    1,
    height - 2,
  );
  const maxSurfaceY = clamp(
    Math.round(options.maxSurfaceY ?? defaultMaxSurface),
    minSurfaceY,
    height - 1,
  );
  const controlPointSpacing = Math.round(
    options.controlPointSpacing ?? Math.max(24, width / 10),
  );
  const roughness = options.roughness ?? Math.max(8, height * 0.065);
  const caveCount = options.caveCount ?? (width >= 320 && height >= 180 ? 3 : 0);
  const bedrockDepth = clamp(
    Math.round(options.bedrockDepth ?? Math.max(4, height * 0.025)),
    1,
    height,
  );

  if (controlPointSpacing < 2) {
    throw new RangeError("controlPointSpacing must be at least 2.");
  }

  if (!Number.isFinite(roughness) || roughness < 0) {
    throw new RangeError("roughness must be a finite non-negative number.");
  }

  if (!Number.isInteger(caveCount) || caveCount < 0) {
    throw new RangeError("caveCount must be a non-negative integer.");
  }

  const random = new SeededRandom(seed);
  const terrain = new TerrainGrid(width, height);
  const pointCount = Math.ceil((width - 1) / controlPointSpacing) + 1;
  const controlPoints: number[] = [];
  const middleSurface = (minSurfaceY + maxSurfaceY) / 2;
  let previousHeight = random.float(minSurfaceY, maxSurfaceY + 1);

  for (let point = 0; point < pointCount; point += 1) {
    const pullToMiddle = (middleSurface - previousHeight) * 0.28;
    const step = random.float(-roughness, roughness);
    previousHeight = clamp(
      previousHeight + pullToMiddle + step,
      minSurfaceY,
      maxSurfaceY,
    );
    controlPoints.push(previousHeight);
  }

  const bedrockStart = height - bedrockDepth;

  for (let x = 0; x < width; x += 1) {
    const pointIndex = Math.min(
      Math.floor(x / controlPointSpacing),
      controlPoints.length - 2,
    );
    const segmentStart = pointIndex * controlPointSpacing;
    const segmentPosition = clamp(
      (x - segmentStart) / controlPointSpacing,
      0,
      1,
    );
    const interpolation = smoothStep(segmentPosition);
    const leftHeight = controlPoints[pointIndex] as number;
    const rightHeight = controlPoints[pointIndex + 1] as number;
    const surface = Math.round(
      leftHeight + (rightHeight - leftHeight) * interpolation,
    );

    for (let y = surface; y < height; y += 1) {
      terrain.set(
        x,
        y,
        y >= bedrockStart ? Material.Rock : Material.Soil,
      );
    }
  }

  if (width >= 64 && height >= 64) {
    for (let cave = 0; cave < caveCount; cave += 1) {
      const radius = random.integer(
        Math.max(6, Math.floor(Math.min(width, height) * 0.025)),
        Math.max(7, Math.floor(Math.min(width, height) * 0.055)),
      );
      const margin = Math.min(
        Math.max(radius + 2, 24),
        Math.floor(width / 2) - 1,
      );
      const centerX = random.integer(margin, width - margin);
      const localSurface = terrain.surfaceY(centerX) ?? minSurfaceY;
      const minCenterY = Math.min(
        height - radius - bedrockDepth - 1,
        localSurface + radius + 18,
      );
      const maxCenterY = height - radius - bedrockDepth;

      if (maxCenterY > minCenterY) {
        const centerY = random.integer(minCenterY, maxCenterY);
        terrain.carveCircle(centerX, centerY, radius);

        if (random.chance(0.65)) {
          const offset = Math.max(4, Math.floor(radius * 0.75));
          terrain.carveCircle(centerX + offset, centerY, radius * 0.8);
        }
      }
    }
  }

  return terrain;
}
