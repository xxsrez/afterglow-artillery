import { Material, type TerrainGrid } from "./terrain";

const SILHOUETTE_SAMPLE_COUNT = 64;
const OCCUPANCY_COLUMN_COUNT = 32;
const OCCUPANCY_ROW_COUNT = 12;
const OCCUPANCY_SAMPLE_COUNT =
  OCCUPANCY_COLUMN_COUNT * OCCUPANCY_ROW_COUNT;
const COMPONENT_CELL_BUDGET = 160_000;
const MIN_COMPONENT_BLOCK_SIZE = 4;

/**
 * Geometry-only measurements of a rasterized battlefield.
 *
 * Distances and spans use world cells. Ratio fields and silhouette samples
 * are normalized to [0, 1], independently of the terrain dimensions.
 */
export interface BattlefieldStructureMetrics {
  /** P95 - P05 of the median-binned surface, in world cells. */
  readonly surfaceRelief: number;
  /** `surfaceRelief` divided by terrain height. */
  readonly surfaceReliefRatio: number;
  /** Significant high points after five-sample triangular smoothing. */
  readonly prominentPeakCount: number;
  /** Significant low points after five-sample triangular smoothing. */
  readonly prominentBasinCount: number;
  /** Distinct short-window surface changes large enough to act as cliffs. */
  readonly cliffCount: number;
  /** Significant solid islands not four-connected to the bottom bedrock. */
  readonly floatingSolidComponentCount: number;
  /** Columns containing a bounded empty run below their first solid cell. */
  readonly roofedColumnCount: number;
  /** `roofedColumnCount` divided by terrain width. */
  readonly roofedColumnRatio: number;
  /** Longest contiguous run of roofed columns, in world cells. */
  readonly undergroundOpenAirSpan: number;
  /**
   * 64 median-binned surface elevations: 0 is the bottom/empty column and
   * 1 is the top of the world.
   */
  readonly surfaceSilhouette: Float32Array;
  /**
   * Row-major 32×12 solid-occupancy field. Each sample is the fraction of
   * solid cells in that normalized world region, so caves, bridges, detached
   * masses and overhangs remain visible even when their top silhouette is
   * unchanged.
   */
  readonly occupancySignature: Float32Array;
}

interface TerrainScan {
  readonly surfaces: Int32Array;
  readonly roofedColumns: Uint8Array;
  readonly blockSize: number;
  readonly componentWidth: number;
  readonly componentHeight: number;
  readonly blockSolidCounts: Uint32Array;
  readonly bottomAnchorBlocks: Uint8Array;
  readonly occupancySolidCounts: Uint32Array;
  readonly occupancyCellCounts: Uint32Array;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Scans the source cells once. Besides the exact top surface, this builds a
 * bounded-resolution solid occupancy representation and detects vertical
 * slices of underground open air.
 */
function scanTerrain(terrain: TerrainGrid): TerrainScan {
  const { width, height, cells } = terrain;
  const blockSize = Math.max(
    MIN_COMPONENT_BLOCK_SIZE,
    Math.ceil(Math.sqrt((width * height) / COMPONENT_CELL_BUDGET)),
  );
  const componentWidth = Math.ceil(width / blockSize);
  const componentHeight = Math.ceil(height / blockSize);
  const surfaces = new Int32Array(width);
  const openRuns = new Int32Array(width);
  const roofedColumns = new Uint8Array(width);
  const blockSolidCounts = new Uint32Array(
    componentWidth * componentHeight,
  );
  const bottomAnchorBlocks = new Uint8Array(componentWidth);
  const occupancySolidCounts = new Uint32Array(OCCUPANCY_SAMPLE_COUNT);
  const occupancyCellCounts = new Uint32Array(OCCUPANCY_SAMPLE_COUNT);
  const minRoofedRun = Math.max(3, Math.round(height * 0.007));

  surfaces.fill(height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    const blockRowOffset =
      Math.floor(y / blockSize) * componentWidth;
    const isBottomRow = y === height - 1;

    for (let x = 0; x < width; x += 1) {
      const material = cells[rowOffset + x] as Material;
      const occupancyX = Math.min(
        OCCUPANCY_COLUMN_COUNT - 1,
        Math.floor((x * OCCUPANCY_COLUMN_COUNT) / width),
      );
      const occupancyY = Math.min(
        OCCUPANCY_ROW_COUNT - 1,
        Math.floor((y * OCCUPANCY_ROW_COUNT) / height),
      );
      const occupancyIndex =
        occupancyY * OCCUPANCY_COLUMN_COUNT + occupancyX;
      occupancyCellCounts[occupancyIndex] += 1;

      if (material === Material.Empty) {
        if (surfaces[x] !== height) {
          openRuns[x] += 1;
        }
        continue;
      }

      occupancySolidCounts[occupancyIndex] += 1;
      if (surfaces[x] === height) {
        surfaces[x] = y;
      } else if (openRuns[x] >= minRoofedRun) {
        // Requiring a later solid cell excludes open shafts that simply run
        // out through the bottom of malformed or deliberately sparse grids.
        roofedColumns[x] = 1;
      }
      openRuns[x] = 0;

      const blockX = Math.floor(x / blockSize);
      blockSolidCounts[blockRowOffset + blockX] += 1;
      if (isBottomRow) {
        bottomAnchorBlocks[blockX] = 1;
      }
    }
  }

  return {
    surfaces,
    roofedColumns,
    blockSize,
    componentWidth,
    componentHeight,
    blockSolidCounts,
    bottomAnchorBlocks,
    occupancySolidCounts,
    occupancyCellCounts,
  };
}

function occupancySignature(scan: TerrainScan): Float32Array {
  const signature = new Float32Array(OCCUPANCY_SAMPLE_COUNT);

  for (let index = 0; index < signature.length; index += 1) {
    const cellCount = scan.occupancyCellCounts[index] as number;
    signature[index] =
      cellCount === 0
        ? 0
        : (scan.occupancySolidCounts[index] as number) / cellCount;
  }

  return signature;
}

function medianSurfaceSilhouette(
  surfaces: Int32Array,
  height: number,
): Float32Array {
  const signature = new Float32Array(SILHOUETTE_SAMPLE_COUNT);
  const scratch = new Int32Array(
    Math.max(
      1,
      Math.ceil(surfaces.length / SILHOUETTE_SAMPLE_COUNT) + 1,
    ),
  );

  for (let sample = 0; sample < SILHOUETTE_SAMPLE_COUNT; sample += 1) {
    let start = Math.floor(
      (sample * surfaces.length) / SILHOUETTE_SAMPLE_COUNT,
    );
    start = Math.min(start, surfaces.length - 1);
    let end = Math.floor(
      ((sample + 1) * surfaces.length) / SILHOUETTE_SAMPLE_COUNT,
    );
    end = Math.min(surfaces.length, Math.max(start + 1, end));
    const count = end - start;

    for (let index = 0; index < count; index += 1) {
      scratch[index] = surfaces[start + index] as number;
    }

    const values = scratch.subarray(0, count);
    values.sort();
    const middle = Math.floor(count / 2);
    const median =
      count % 2 === 1
        ? (values[middle] as number)
        : ((values[middle - 1] as number) +
            (values[middle] as number)) /
          2;

    signature[sample] = clamp01((height - median) / height);
  }

  return signature;
}

function percentile(sorted: Float64Array, probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const interpolation = position - lower;

  return (
    (sorted[lower] as number) * (1 - interpolation) +
    (sorted[upper] as number) * interpolation
  );
}

function reliefRatio(signature: Float32Array): number {
  const sorted = new Float64Array(signature.length);
  for (let index = 0; index < signature.length; index += 1) {
    sorted[index] = signature[index] as number;
  }
  sorted.sort();

  return Math.max(
    0,
    percentile(sorted, 0.95) - percentile(sorted, 0.05),
  );
}

function smoothSilhouette(signature: Float32Array): Float64Array {
  const smoothed = new Float64Array(signature.length);

  for (let index = 0; index < signature.length; index += 1) {
    let weightedTotal = 0;
    let totalWeight = 0;

    for (let offset = -2; offset <= 2; offset += 1) {
      const neighbor = index + offset;
      if (neighbor < 0 || neighbor >= signature.length) {
        continue;
      }

      const weight = 3 - Math.abs(offset);
      weightedTotal += (signature[neighbor] as number) * weight;
      totalWeight += weight;
    }

    smoothed[index] = weightedTotal / totalWeight;
  }

  return smoothed;
}

function countProminentExtrema(
  smoothed: Float64Array,
  prominenceThreshold: number,
  peak: boolean,
): number {
  const comparisonRadius = Math.max(
    3,
    Math.floor(smoothed.length / 10),
  );
  const minSeparation = Math.max(
    2,
    Math.floor(smoothed.length / 16),
  );
  let count = 0;
  let lastAccepted = -minSeparation;

  for (let index = 1; index < smoothed.length - 1; index += 1) {
    const previous = smoothed[index - 1] as number;
    const current = smoothed[index] as number;
    const next = smoothed[index + 1] as number;
    const isTurningPoint = peak
      ? current > previous && current >= next
      : current < previous && current <= next;

    if (!isTurningPoint) {
      continue;
    }

    let leftExtreme = peak ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    let rightExtreme = leftExtreme;
    const leftBound = Math.max(0, index - comparisonRadius);
    const rightBound = Math.min(
      smoothed.length - 1,
      index + comparisonRadius,
    );

    for (let neighbor = leftBound; neighbor < index; neighbor += 1) {
      const value = smoothed[neighbor] as number;
      leftExtreme = peak
        ? Math.min(leftExtreme, value)
        : Math.max(leftExtreme, value);
    }
    for (let neighbor = index + 1; neighbor <= rightBound; neighbor += 1) {
      const value = smoothed[neighbor] as number;
      rightExtreme = peak
        ? Math.min(rightExtreme, value)
        : Math.max(rightExtreme, value);
    }

    const prominence = peak
      ? Math.min(current - leftExtreme, current - rightExtreme)
      : Math.min(leftExtreme - current, rightExtreme - current);

    if (
      prominence < prominenceThreshold ||
      index - lastAccepted < minSeparation
    ) {
      continue;
    }

    count += 1;
    lastAccepted = index;
  }

  return count;
}

function countCliffs(
  signature: Float32Array,
  surfaceReliefRatio: number,
): number {
  // The centered two-bin window covers 3.125% of the battlefield. A change
  // of at least 5.5% world height is intentionally too steep for ordinary
  // rolling noise, while the relief-scaled cap avoids overcounting rugged
  // maps.
  const threshold = Math.max(
    0.055,
    Math.min(0.09, surfaceReliefRatio * 0.4),
  );
  let count = 0;
  let activeSign = 0;

  for (let index = 1; index < signature.length - 1; index += 1) {
    const delta =
      (signature[index + 1] as number) -
      (signature[index - 1] as number);

    if (Math.abs(delta) < threshold) {
      activeSign = 0;
      continue;
    }

    const sign = delta < 0 ? -1 : 1;
    if (activeSign !== sign) {
      count += 1;
      activeSign = sign;
    }
  }

  return count;
}

function countFloatingSolidComponents(
  terrain: TerrainGrid,
  scan: TerrainScan,
): number {
  const {
    blockSize,
    componentWidth,
    componentHeight,
    blockSolidCounts,
    bottomAnchorBlocks,
  } = scan;
  const componentCellCount = componentWidth * componentHeight;
  const occupied = new Uint8Array(componentCellCount);
  const visited = new Uint8Array(componentCellCount);
  const queue = new Int32Array(componentCellCount);

  for (let blockY = 0; blockY < componentHeight; blockY += 1) {
    const blockHeight = Math.min(
      blockSize,
      terrain.height - blockY * blockSize,
    );

    for (let blockX = 0; blockX < componentWidth; blockX += 1) {
      const blockWidth = Math.min(
        blockSize,
        terrain.width - blockX * blockSize,
      );
      const index = blockY * componentWidth + blockX;
      const blockArea = blockWidth * blockHeight;

      // A quarter-filled block retains substantial shelves and overhangs
      // without letting isolated one-cell noise bridge large components.
      if ((blockSolidCounts[index] as number) * 4 >= blockArea) {
        occupied[index] = 1;
      }
    }
  }

  const minArea = Math.max(
    blockSize * blockSize * 6,
    Math.round(terrain.width * terrain.height * 0.0003),
  );
  const minHorizontalSpan = Math.max(
    blockSize * 4,
    Math.round(terrain.width * 0.015),
  );
  const minVerticalSpan = Math.max(
    blockSize * 3,
    Math.round(terrain.height * 0.02),
  );
  let floatingCount = 0;

  for (let start = 0; start < componentCellCount; start += 1) {
    if (occupied[start] === 0 || visited[start] !== 0) {
      continue;
    }

    let head = 0;
    let tail = 0;
    let solidArea = 0;
    let minBlockX = componentWidth;
    let maxBlockX = -1;
    let minBlockY = componentHeight;
    let maxBlockY = -1;
    let bottomAnchored = false;
    queue[tail] = start;
    tail += 1;
    visited[start] = 1;

    while (head < tail) {
      const index = queue[head] as number;
      head += 1;
      const blockY = Math.floor(index / componentWidth);
      const blockX = index - blockY * componentWidth;

      solidArea += blockSolidCounts[index] as number;
      minBlockX = Math.min(minBlockX, blockX);
      maxBlockX = Math.max(maxBlockX, blockX);
      minBlockY = Math.min(minBlockY, blockY);
      maxBlockY = Math.max(maxBlockY, blockY);
      if (
        blockY === componentHeight - 1 &&
        bottomAnchorBlocks[blockX] !== 0
      ) {
        bottomAnchored = true;
      }

      if (blockX > 0) {
        const neighbor = index - 1;
        if (occupied[neighbor] !== 0 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
      if (blockX + 1 < componentWidth) {
        const neighbor = index + 1;
        if (occupied[neighbor] !== 0 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
      if (blockY > 0) {
        const neighbor = index - componentWidth;
        if (occupied[neighbor] !== 0 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
      if (blockY + 1 < componentHeight) {
        const neighbor = index + componentWidth;
        if (occupied[neighbor] !== 0 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
    }

    if (bottomAnchored || solidArea < minArea) {
      continue;
    }

    const horizontalSpan =
      Math.min(terrain.width, (maxBlockX + 1) * blockSize) -
      minBlockX * blockSize;
    const verticalSpan =
      Math.min(terrain.height, (maxBlockY + 1) * blockSize) -
      minBlockY * blockSize;

    if (
      horizontalSpan >= minHorizontalSpan ||
      verticalSpan >= minVerticalSpan
    ) {
      floatingCount += 1;
    }
  }

  return floatingCount;
}

function roofedSpan(roofedColumns: Uint8Array): {
  readonly count: number;
  readonly longest: number;
} {
  let count = 0;
  let current = 0;
  let longest = 0;

  for (let x = 0; x < roofedColumns.length; x += 1) {
    if (roofedColumns[x] === 0) {
      current = 0;
      continue;
    }

    count += 1;
    current += 1;
    longest = Math.max(longest, current);
  }

  return { count, longest };
}

/**
 * Measures structural properties from final terrain cells without consulting
 * the planner, seed, spawn metadata or presentation state.
 */
export function measureBattlefieldStructure(
  terrain: TerrainGrid,
): BattlefieldStructureMetrics {
  const scan = scanTerrain(terrain);
  const surfaceSilhouette = medianSurfaceSilhouette(
    scan.surfaces,
    terrain.height,
  );
  const surfaceReliefRatio = reliefRatio(surfaceSilhouette);
  const smoothed = smoothSilhouette(surfaceSilhouette);
  const prominenceThreshold = Math.max(
    0.025,
    Math.min(0.06, surfaceReliefRatio * 0.18),
  );
  const roofed = roofedSpan(scan.roofedColumns);

  return {
    surfaceRelief: surfaceReliefRatio * terrain.height,
    surfaceReliefRatio,
    prominentPeakCount: countProminentExtrema(
      smoothed,
      prominenceThreshold,
      true,
    ),
    prominentBasinCount: countProminentExtrema(
      smoothed,
      prominenceThreshold,
      false,
    ),
    cliffCount: countCliffs(surfaceSilhouette, surfaceReliefRatio),
    floatingSolidComponentCount: countFloatingSolidComponents(
      terrain,
      scan,
    ),
    roofedColumnCount: roofed.count,
    roofedColumnRatio: roofed.count / terrain.width,
    undergroundOpenAirSpan: roofed.longest,
    surfaceSilhouette,
    occupancySignature: occupancySignature(scan),
  };
}

/**
 * Root-mean-square silhouette distance, minimized across direct and horizontal
 * mirror alignment. Both inputs must be equally sized normalized signatures.
 */
export function mirrorInvariantSilhouetteDistance(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): number {
  if (left.length === 0 || left.length !== right.length) {
    throw new RangeError(
      "Silhouette signatures must be non-empty and equally sized.",
    );
  }

  let directSquaredError = 0;
  let mirroredSquaredError = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] as number;
    const rightValue = right[index] as number;
    const mirroredValue = right[right.length - index - 1] as number;

    if (
      !Number.isFinite(leftValue) ||
      !Number.isFinite(rightValue) ||
      leftValue < 0 ||
      leftValue > 1 ||
      rightValue < 0 ||
      rightValue > 1
    ) {
      throw new RangeError(
        "Silhouette samples must be finite numbers between 0 and 1.",
      );
    }

    const directDifference = leftValue - rightValue;
    const mirroredDifference = leftValue - mirroredValue;
    directSquaredError += directDifference * directDifference;
    mirroredSquaredError += mirroredDifference * mirroredDifference;
  }

  return Math.sqrt(
    Math.min(directSquaredError, mirroredSquaredError) / left.length,
  );
}

/**
 * Root-mean-square distance between two normalized 32×12 occupancy fields,
 * minimized across direct and horizontal-mirror alignment.
 */
export function mirrorInvariantOccupancyDistance(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): number {
  if (
    left.length !== OCCUPANCY_SAMPLE_COUNT ||
    right.length !== OCCUPANCY_SAMPLE_COUNT
  ) {
    throw new RangeError(
      `Occupancy signatures must contain ${OCCUPANCY_SAMPLE_COUNT} samples.`,
    );
  }

  let directSquaredError = 0;
  let mirroredSquaredError = 0;

  for (let row = 0; row < OCCUPANCY_ROW_COUNT; row += 1) {
    const rowOffset = row * OCCUPANCY_COLUMN_COUNT;
    for (let column = 0; column < OCCUPANCY_COLUMN_COUNT; column += 1) {
      const index = rowOffset + column;
      const mirroredIndex =
        rowOffset + OCCUPANCY_COLUMN_COUNT - column - 1;
      const leftValue = left[index] as number;
      const rightValue = right[index] as number;
      const mirroredValue = right[mirroredIndex] as number;

      if (
        !Number.isFinite(leftValue) ||
        !Number.isFinite(rightValue) ||
        !Number.isFinite(mirroredValue) ||
        leftValue < 0 ||
        leftValue > 1 ||
        rightValue < 0 ||
        rightValue > 1 ||
        mirroredValue < 0 ||
        mirroredValue > 1
      ) {
        throw new RangeError(
          "Occupancy samples must be finite numbers between 0 and 1.",
        );
      }

      const directDifference = leftValue - rightValue;
      const mirroredDifference = leftValue - mirroredValue;
      directSquaredError += directDifference * directDifference;
      mirroredSquaredError += mirroredDifference * mirroredDifference;
    }
  }

  return Math.sqrt(
    Math.min(directSquaredError, mirroredSquaredError) /
      OCCUPANCY_SAMPLE_COUNT,
  );
}
