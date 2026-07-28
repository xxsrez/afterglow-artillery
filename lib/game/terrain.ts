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
  readonly tunnelCount?: number;
  readonly bedrockDepth?: number;
}

export interface SpawnSite {
  readonly x: number;
  readonly y: number;
}

export interface SpawnSiteOptions {
  readonly count?: number;
  readonly edgeMargin?: number;
  readonly minSeparation?: number;
  readonly padHalfWidth?: number;
  readonly maxSurfaceDelta?: number;
  readonly tankHalfHeight?: number;
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

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function carveBlob(
  terrain: TerrainGrid,
  centerX: number,
  centerY: number,
  radius: number,
  random: SeededRandom,
): void {
  terrain.carveCircle(centerX, centerY, radius);

  const lobeCount = random.integer(1, 3);
  for (let lobe = 0; lobe < lobeCount; lobe += 1) {
    const angle = random.float(0, Math.PI * 2);
    const offset = radius * random.float(0.45, 0.95);
    terrain.carveCircle(
      centerX + Math.cos(angle) * offset,
      centerY + Math.sin(angle) * offset * random.float(0.72, 1.12),
      radius * random.float(0.52, 0.88),
    );
  }
}

interface CavePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Overlapping discs form a guaranteed connected passage. The perpendicular
 * wobble gives the tunnel an organic silhouette without ever breaking the
 * traversable empty-space chain.
 */
function carvePassage(
  terrain: TerrainGrid,
  random: SeededRandom,
  from: CavePoint,
  to: CavePoint,
  minRadius: number,
  maxRadius: number,
): void {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  const stepLength = Math.max(2.5, minRadius * 0.72);
  const steps = Math.max(1, Math.ceil(distance / stepLength));
  const normalX = distance === 0 ? 0 : -deltaY / distance;
  const normalY = distance === 0 ? 0 : deltaX / distance;
  const wobblePhase = random.float(0, Math.PI * 2);
  const wobbleAmplitude = Math.min(
    maxRadius * 0.65,
    Math.max(1, distance * 0.035),
  );

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const taper = Math.sin(progress * Math.PI);
    const wobble =
      Math.sin(progress * Math.PI * 3 + wobblePhase) *
      wobbleAmplitude *
      taper;
    const x = from.x + deltaX * progress + normalX * wobble;
    const y = from.y + deltaY * progress + normalY * wobble;
    const radius = clamp(
      minRadius +
        (maxRadius - minRadius) *
          (0.35 + 0.4 * Math.sin(progress * Math.PI)) +
        random.float(-0.65, 0.65),
      minRadius,
      maxRadius,
    );

    terrain.carveCircle(x, y, radius);
  }
}

/**
 * Builds one to three internally connected cave graphs. Every graph has a
 * sloped surface mouth, a chain of chambers and additional branch passages.
 */
function carveCaveNetworks(
  terrain: TerrainGrid,
  random: SeededRandom,
  surfaceProfile: readonly number[],
  caveCount: number,
  tunnelCount: number,
  bedrockStart: number,
): void {
  if (caveCount === 0 && tunnelCount === 0) {
    return;
  }

  const smallestDimension = Math.min(terrain.width, terrain.height);
  const passageMinRadius = Math.max(3.5, smallestDimension * 0.009);
  const passageMaxRadius = Math.max(
    passageMinRadius + 1.5,
    smallestDimension * 0.017,
  );
  const chamberMinRadius = Math.max(7, smallestDimension * 0.024);
  const chamberMaxRadius = Math.max(
    chamberMinRadius + 2,
    smallestDimension * 0.052,
  );
  const horizontalMargin = Math.max(12, Math.round(terrain.width * 0.025));
  const networkCount = Math.max(
    1,
    Math.min(3, Math.ceil(Math.max(1, caveCount) / 4)),
  );
  const availableWidth = terrain.width - horizontalMargin * 2;
  const bandWidth = availableWidth / networkCount;

  for (let network = 0; network < networkCount; network += 1) {
    const bandLeft = horizontalMargin + bandWidth * network;
    const bandRight = horizontalMargin + bandWidth * (network + 1);
    const entranceInset = Math.min(18, Math.max(3, bandWidth * 0.12));
    const entranceMinX = Math.ceil(bandLeft + entranceInset);
    const entranceMaxX = Math.floor(bandRight - entranceInset);
    const entranceX =
      entranceMaxX > entranceMinX
        ? random.integer(entranceMinX, entranceMaxX + 1)
        : Math.round((bandLeft + bandRight) / 2);
    const entranceSurface =
      surfaceProfile[entranceX] ??
      terrain.surfaceY(entranceX) ??
      Math.round(terrain.height * 0.48);
    const cavernBottom = Math.max(
      entranceSurface + 6,
      bedrockStart - Math.ceil(chamberMaxRadius) - 3,
    );
    const rootDepth = Math.max(
      passageMaxRadius * 3,
      Math.min(terrain.height * 0.12, 74),
    );
    const root: CavePoint = {
      x: clamp(
        entranceX + random.float(-bandWidth * 0.08, bandWidth * 0.08),
        bandLeft + chamberMinRadius,
        bandRight - chamberMinRadius,
      ),
      y: clamp(
        entranceSurface + rootDepth,
        entranceSurface + passageMaxRadius * 2,
        cavernBottom,
      ),
    };
    const mouth: CavePoint = {
      x: entranceX,
      y: Math.max(0, entranceSurface - passageMaxRadius - 2),
    };

    carvePassage(
      terrain,
      random,
      mouth,
      root,
      passageMinRadius,
      passageMaxRadius,
    );
    carveBlob(
      terrain,
      root.x,
      root.y,
      random.float(chamberMinRadius, chamberMaxRadius),
      random,
    );

    const nodes: CavePoint[] = [root];
    const chambersInNetwork =
      Math.floor(caveCount / networkCount) +
      (network < caveCount % networkCount ? 1 : 0);
    let previous = root;

    for (let chamber = 1; chamber < Math.max(1, chambersInNetwork); chamber += 1) {
      const direction = chamber % 2 === 0 ? -1 : 1;
      const horizontalReach = random.float(
        Math.max(24, bandWidth * 0.12),
        Math.max(28, bandWidth * 0.32),
      );
      const next: CavePoint = {
        x: clamp(
          previous.x + direction * horizontalReach,
          bandLeft + chamberMaxRadius,
          bandRight - chamberMaxRadius,
        ),
        y: clamp(
          previous.y + random.float(-terrain.height * 0.08, terrain.height * 0.1),
          entranceSurface + passageMaxRadius * 2,
          cavernBottom,
        ),
      };

      carvePassage(
        terrain,
        random,
        previous,
        next,
        passageMinRadius,
        passageMaxRadius,
      );
      carveBlob(
        terrain,
        next.x,
        next.y,
        random.float(chamberMinRadius, chamberMaxRadius),
        random,
      );
      nodes.push(next);
      previous = next;
    }

    const branchesInNetwork =
      Math.floor(tunnelCount / networkCount) +
      (network < tunnelCount % networkCount ? 1 : 0);

    for (let branch = 0; branch < branchesInNetwork; branch += 1) {
      const anchor = random.pick(nodes);
      const branchDirection = branch % 2 === 0 ? -1 : 1;
      const endpoint: CavePoint = {
        x: clamp(
          anchor.x +
            branchDirection *
              random.float(
                Math.max(18, bandWidth * 0.07),
                Math.max(24, bandWidth * 0.2),
              ),
          bandLeft + passageMaxRadius,
          bandRight - passageMaxRadius,
        ),
        y: clamp(
          anchor.y + random.float(-terrain.height * 0.09, terrain.height * 0.11),
          entranceSurface + passageMaxRadius,
          cavernBottom,
        ),
      };

      carvePassage(
        terrain,
        random,
        anchor,
        endpoint,
        passageMinRadius * 0.82,
        passageMaxRadius * 0.9,
      );

      if (branch % 2 === 0) {
        carveBlob(
          terrain,
          endpoint.x,
          endpoint.y,
          random.float(chamberMinRadius * 0.55, chamberMaxRadius * 0.72),
          random,
        );
      }
    }
  }
}

function localSurfaceWindow(
  terrain: TerrainGrid,
  centerX: number,
  halfWidth: number,
): readonly number[] | null {
  const samples: number[] = [];

  for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += 1) {
    const surface = terrain.surfaceY(x);
    if (surface === null) {
      return null;
    }
    samples.push(surface);
  }

  return samples;
}

function sculptSpawnShelf(
  terrain: TerrainGrid,
  centerX: number,
  padHalfWidth: number,
): number {
  const shoulderWidth = Math.max(5, Math.round(padHalfWidth * 0.35));
  const outerHalfWidth = padHalfWidth + shoulderWidth;
  const surfaces =
    localSurfaceWindow(terrain, centerX, outerHalfWidth) ??
    [Math.round(terrain.height * 0.5)];
  const targetSurface = clamp(
    Math.round(average(surfaces)),
    28,
    Math.max(28, terrain.height - 28),
  );
  const left = clamp(centerX - outerHalfWidth, 1, terrain.width - 2);
  const right = clamp(centerX + outerHalfWidth, 1, terrain.width - 2);

  for (let x = left; x <= right; x += 1) {
    const distance = Math.abs(x - centerX);
    const originalSurface = terrain.surfaceY(x) ?? targetSurface;
    const shoulderProgress = clamp(
      (distance - padHalfWidth) / shoulderWidth,
      0,
      1,
    );
    const columnSurface =
      distance <= padHalfWidth
        ? targetSurface
        : Math.round(
            targetSurface +
              (originalSurface - targetSurface) *
                smoothStep(shoulderProgress),
          );

    for (let y = 0; y < columnSurface; y += 1) {
      terrain.set(x, y, Material.Empty);
    }

    const connectedDepth = Math.max(columnSurface + 16, originalSurface + 2);
    for (
      let y = columnSurface;
      y < Math.min(connectedDepth, terrain.height);
      y += 1
    ) {
      if (terrain.get(x, y) !== Material.Rock) {
        terrain.set(x, y, Material.Soil);
      }
    }
  }

  return targetSurface;
}

export function findSpawnSites(
  terrain: TerrainGrid,
  options: SpawnSiteOptions = {},
): readonly SpawnSite[] {
  const count = options.count ?? 2;
  const edgeMargin = clamp(
    Math.round(options.edgeMargin ?? Math.max(96, terrain.width * 0.08)),
    12,
    Math.max(12, Math.floor(terrain.width / 3)),
  );
  const padHalfWidth = clamp(
    Math.round(options.padHalfWidth ?? 20),
    8,
    Math.max(8, Math.floor(terrain.width / 10)),
  );
  const maxSurfaceDelta = clamp(
    Math.round(options.maxSurfaceDelta ?? 12),
    2,
    Math.max(2, Math.floor(terrain.height / 12)),
  );
  const tankHalfHeight = clamp(
    Math.round(options.tankHalfHeight ?? 11),
    1,
    Math.max(1, Math.floor(terrain.height / 8)),
  );
  const minSeparation = clamp(
    Math.round(options.minSeparation ?? terrain.width * 0.52),
    padHalfWidth * 3,
    Math.max(padHalfWidth * 3, terrain.width - edgeMargin * 2),
  );

  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError("count must be a positive integer.");
  }

  const candidateForBand = (
    bandLeft: number,
    bandRight: number,
    targetX: number,
    separatedFrom?: number,
  ): number | null => {
    const candidates: { x: number; score: number }[] = [];

    for (let x = Math.ceil(bandLeft); x <= Math.floor(bandRight); x += 4) {
      if (
        separatedFrom !== undefined &&
        Math.abs(x - separatedFrom) < minSeparation
      ) {
        continue;
      }

      const surfaces = localSurfaceWindow(terrain, x, padHalfWidth);
      if (!surfaces) {
        continue;
      }

      const surfaceMin = Math.min(...surfaces);
      const surfaceMax = Math.max(...surfaces);
      const surfaceDelta = surfaceMax - surfaceMin;

      if (surfaceDelta > maxSurfaceDelta) {
        continue;
      }

      candidates.push({
        x,
        score: surfaceDelta * 14 + Math.abs(x - targetX) * 0.04,
      });
    }

    candidates.sort(
      (left, right) => left.score - right.score || left.x - right.x,
    );
    return candidates[0]?.x ?? null;
  };

  const pickedX: number[] = [];

  if (count === 2) {
    const leftBand = {
      left: edgeMargin,
      right: Math.max(edgeMargin, Math.floor(terrain.width * 0.33)),
      target: terrain.width * 0.2,
    };
    const rightBand = {
      left: Math.min(
        terrain.width - edgeMargin,
        Math.ceil(terrain.width * 0.67),
      ),
      right: terrain.width - edgeMargin,
      target: terrain.width * 0.8,
    };
    const leftX =
      candidateForBand(leftBand.left, leftBand.right, leftBand.target) ??
      clamp(
        Math.round(leftBand.target),
        leftBand.left,
        leftBand.right,
      );
    const rightX =
      candidateForBand(
        rightBand.left,
        rightBand.right,
        rightBand.target,
        leftX,
      ) ??
      clamp(
        Math.max(Math.round(rightBand.target), leftX + minSeparation),
        rightBand.left,
        rightBand.right,
      );

    pickedX.push(leftX, rightX);
  } else {
    for (let index = 0; index < count; index += 1) {
      const target = ((index + 1) / (count + 1)) * terrain.width;
      const halfBand = terrain.width / (count + 1) * 0.32;
      const bandLeft = clamp(target - halfBand, edgeMargin, terrain.width);
      const bandRight = clamp(
        target + halfBand,
        bandLeft,
        terrain.width - edgeMargin,
      );
      const previous = pickedX.at(-1);
      const candidate =
        candidateForBand(bandLeft, bandRight, target, previous) ??
        clamp(Math.round(target), bandLeft, bandRight);
      pickedX.push(candidate);
    }
  }

  return pickedX
    .sort((left, right) => left - right)
    .map((x) => {
      const supportY = sculptSpawnShelf(terrain, x, padHalfWidth);
      return {
        x,
        y: supportY - tankHalfHeight,
      };
    });
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
   * Returns the first solid cell in a column at or below `startY`.
   *
   * Unlike `surfaceY`, this can find the floor of a cave or the next ledge
   * below a destroyed tank. Coordinates above the grid start at row zero;
   * coordinates below the grid and outside columns have no support.
   */
  public firstSolidYAtOrBelow(x: number, startY: number): number | null {
    const cellX = Math.floor(x);
    const firstY = Math.max(0, Math.floor(startY));

    if (
      !Number.isFinite(cellX) ||
      !Number.isFinite(firstY) ||
      cellX < 0 ||
      cellX >= this.width ||
      firstY >= this.height
    ) {
      return null;
    }

    for (let y = firstY; y < this.height; y += 1) {
      if (this.cells[this.indexOf(cellX, y)] !== Material.Empty) {
        return y;
      }
    }

    return null;
  }

  /**
   * Returns the first solid cell from the top, or null for an empty/outside
   * column. Internal caves therefore do not erase the playable surface.
   */
  public surfaceY(x: number): number | null {
    return this.firstSolidYAtOrBelow(x, 0);
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
 * Generates a large destructible battlefield with steep ridges, internal
 * cavities and meandering tunnels. The grid remains the source of truth; the
 * interpolated surface is only used at generation time.
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
    options.controlPointSpacing ?? Math.max(36, width / 14),
  );
  const roughness = options.roughness ?? Math.max(8, height * 0.095);
  const caveCount =
    options.caveCount ??
    (width >= 320 && height >= 180
      ? clamp(Math.round(width / 260), 4, 12)
      : 0);
  const tunnelCount =
    options.tunnelCount ??
    (caveCount === 0
      ? 0
      : clamp(Math.round(width / 170), caveCount, 20));
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

  if (!Number.isInteger(tunnelCount) || tunnelCount < 0) {
    throw new RangeError("tunnelCount must be a non-negative integer.");
  }

  const random = new SeededRandom(seed);
  const terrain = new TerrainGrid(width, height);
  const pointCount = Math.ceil((width - 1) / controlPointSpacing) + 1;
  const controlPoints: number[] = [];
  const surfaceProfile: number[] = [];
  const middleSurface = (minSurfaceY + maxSurfaceY) / 2;
  let previousHeight = random.float(minSurfaceY, maxSurfaceY + 1);

  for (let point = 0; point < pointCount; point += 1) {
    const pullToMiddle = (middleSurface - previousHeight) * 0.24;
    const step = random.float(-roughness, roughness);
    previousHeight = clamp(
      previousHeight + pullToMiddle + step,
      minSurfaceY,
      maxSurfaceY,
    );
    controlPoints.push(previousHeight);
  }

  const detailSpacing = Math.max(8, Math.round(controlPointSpacing / 7));
  const detailPointCount = Math.ceil((width - 1) / detailSpacing) + 2;
  const detailPoints = Array.from({ length: detailPointCount }, () =>
    random.float(-1, 1),
  );
  const longWavePhase = random.float(0, Math.PI * 2);
  const ridgePhase = random.float(0, Math.PI * 2);
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
    const macroSurface = leftHeight + (rightHeight - leftHeight) * interpolation;

    const detailIndex = Math.min(
      Math.floor(x / detailSpacing),
      detailPoints.length - 2,
    );
    const detailStart = detailIndex * detailSpacing;
    const detailPosition = clamp((x - detailStart) / detailSpacing, 0, 1);
    const detailInterpolation = smoothStep(detailPosition);
    const leftDetail = detailPoints[detailIndex] as number;
    const rightDetail = detailPoints[detailIndex + 1] as number;
    const detailNoise =
      leftDetail + (rightDetail - leftDetail) * detailInterpolation;
    const normalizedX = x / Math.max(1, width - 1);
    const longWave =
      Math.sin(normalizedX * Math.PI * 3.2 + longWavePhase) *
      roughness *
      0.2;
    const ridgeNoise =
      Math.sin(normalizedX * Math.PI * 13 + ridgePhase) *
      Math.sin(normalizedX * Math.PI * 4.4 + longWavePhase) *
      roughness *
      0.12;
    const surface = clamp(
      Math.round(
        macroSurface +
          longWave +
          detailNoise * roughness * 0.28 +
          ridgeNoise,
      ),
      minSurfaceY,
      maxSurfaceY,
    );
    surfaceProfile.push(surface);

    for (let y = surface; y < height; y += 1) {
      terrain.set(
        x,
        y,
        y >= bedrockStart ? Material.Rock : Material.Soil,
      );
    }
  }

  if (width >= 64 && height >= 64) {
    carveCaveNetworks(
      terrain,
      random,
      surfaceProfile,
      caveCount,
      tunnelCount,
      bedrockStart,
    );
  }

  // Generation operations may overlap the bottom edge. Reasserting bedrock
  // here makes its thickness an invariant rather than a best-effort bound.
  for (let y = bedrockStart; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      terrain.set(x, y, Material.Rock);
    }
  }

  return terrain;
}
