import { describe, expect, it } from "vitest";

import {
  linePath,
  pointAlongPath,
  pointAlongPathInto,
  samplePath,
} from "../lib/game";

describe("shared path geometry", () => {
  it("clamps and interpolates path points consistently", () => {
    const path = [
      { x: 0, y: 10 },
      { x: 10, y: 20 },
      { x: 30, y: 0 },
    ];

    expect(pointAlongPath(path, -1)).toEqual({ x: 0, y: 10 });
    expect(pointAlongPath(path, 0.25)).toEqual({ x: 5, y: 15 });
    expect(pointAlongPath(path, 0.75)).toEqual({ x: 20, y: 10 });
    expect(pointAlongPath(path, 2)).toEqual({ x: 30, y: 0 });
    expect(pointAlongPath([], 0.5)).toBeNull();
  });

  it("writes into reusable storage without touching it for an empty path", () => {
    const output = { x: 91, y: 47 };

    expect(
      pointAlongPathInto(
        [
          { x: 2, y: 4 },
          { x: 10, y: 20 },
        ],
        0.5,
        output,
      ),
    ).toBe(true);
    expect(output).toEqual({ x: 6, y: 12 });

    expect(pointAlongPathInto([], 0.5, output)).toBe(false);
    expect(output).toEqual({ x: 6, y: 12 });
  });

  it("bounds sampled paths while retaining order and both endpoints", () => {
    const path = Array.from({ length: 401 }, (_, index) => ({
      x: index,
      y: index * 2,
    }));
    const sampled = samplePath(path, 17);

    expect(sampled).toHaveLength(17);
    expect(sampled[0]).toEqual(path[0]);
    expect(sampled.at(-1)).toEqual(path.at(-1));
    expect(sampled.map(({ x }) => x)).toEqual(
      [...sampled.map(({ x }) => x)].sort((left, right) => left - right),
    );
    const shortPath = path.slice(0, 4);
    expect(samplePath(shortPath, 8)).toBe(shortPath);
    expect(() => samplePath(path, 0)).toThrow(RangeError);
  });

  it("builds inclusive straight paths and handles a single requested point", () => {
    expect(linePath({ x: 2, y: 5 }, { x: 14, y: 17 }, 4)).toEqual([
      { x: 2, y: 5 },
      { x: 6, y: 9 },
      { x: 10, y: 13 },
      { x: 14, y: 17 },
    ]);
    expect(linePath({ x: 2, y: 5 }, { x: 14, y: 17 }, 1)).toEqual([
      { x: 2, y: 5 },
    ]);
    expect(() => linePath({ x: 0, y: 0 }, { x: 1, y: 1 }, -1)).toThrow(
      RangeError,
    );
  });
});
