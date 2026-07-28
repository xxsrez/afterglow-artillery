import { describe, expect, it } from "vitest";

import {
  EXPERIMENTAL_PARTICLE_CAPS,
  EXPERIMENTAL_ULTIMATES,
  EXPERIMENTAL_ULTIMATE_IDS,
  Material,
  TerrainGrid,
  WEAPONS,
  WEAPON_IDS,
  getExperimentalUltimate,
  resolveExperimentalUltimate,
  type ExperimentalResolutionResult,
  type ExperimentalUltimateId,
} from "../lib/game";

function makeTerrain(): TerrainGrid {
  const terrain = new TerrainGrid(220, 150);
  for (let y = 80; y < terrain.height; y += 1) {
    for (let x = 0; x < terrain.width; x += 1) {
      terrain.set(
        x,
        y,
        y >= 142 ? Material.Rock : Material.Soil,
      );
    }
  }

  for (let x = 72; x <= 148; x += 1) {
    terrain.set(x, 61, Material.Soil);
  }
  return terrain;
}

function makeCaveTerrain(): TerrainGrid {
  const terrain = new TerrainGrid(300, 220);

  for (let y = 50; y < terrain.height; y += 1) {
    for (let x = 0; x < terrain.width; x += 1) {
      terrain.set(
        x,
        y,
        y >= 210 ? Material.Rock : Material.Soil,
      );
    }
  }

  for (let y = 95; y < 160; y += 1) {
    for (let x = 35; x <= 265; x += 1) {
      terrain.set(x, y, Material.Empty);
    }
  }

  return terrain;
}

function resolve(
  ultimateId: ExperimentalUltimateId,
): ExperimentalResolutionResult {
  return resolveExperimentalUltimate({
    ultimateId,
    seed: getExperimentalUltimate(ultimateId).testSeed,
    origin: { x: 28, y: 62 },
    impact: { x: 110, y: 80 },
    direction: 1,
    terrain: makeTerrain(),
    tanks: [
      {
        id: "near",
        x: 105,
        y: 69,
        health: 100,
        maxHealth: 100,
      },
      {
        id: "ring",
        x: 166,
        y: 69,
        health: 100,
        maxHealth: 100,
      },
    ],
  });
}

function changedCellCount(
  before: TerrainGrid,
  after: TerrainGrid,
): number {
  let changed = 0;
  for (let index = 0; index < before.cells.length; index += 1) {
    if (before.cells[index] !== after.cells[index]) {
      changed += 1;
    }
  }
  return changed;
}

const STRATEGY_ASSERTIONS: Record<
  ExperimentalUltimateId,
  (result: ExperimentalResolutionResult) => void
> = {
  heliosSpire: (result) => {
    expect(
      result.eventLog.some(
        (event) => event.type === "node" && event.role === "marker",
      ),
    ).toBe(true);
    expect(
      result.eventLog.some((event) => event.type === "tank-damaged"),
    ).toBe(true);
  },
  gravityCathedral: (result) => {
    expect(
      result.eventLog.filter(
        (event) =>
          event.type === "node" && event.role === "pulse",
      ),
    ).toHaveLength(3);
    expect(
      result.eventLog.some((event) => event.type === "tank-displaced"),
    ).toBe(true);
  },
  mirrorStorm: (result) => {
    const bounces = result.eventLog.filter(
      (event) => event.type === "node" && event.role === "bounce",
    );
    expect(bounces.length).toBeGreaterThanOrEqual(4);
    expect(bounces.length).toBeLessThanOrEqual(6);
  },
  chronoEcho: (result) => {
    expect(
      result.eventLog.filter(
        (event) => event.type === "node" && event.role === "echo",
      ),
    ).toHaveLength(6);
  },
  portalComet: (result) => {
    expect(
      result.eventLog.filter(
        (event) =>
          event.type === "node" &&
          (event.role === "portal-in" || event.role === "portal-out"),
      ),
    ).toHaveLength(2);
    expect(
      result.eventLog.filter(
        (event) => event.type === "node" && event.role === "mini-impact",
      ),
    ).toHaveLength(6);
  },
  crystalLattice: (result) => {
    const transmutation = result.eventLog.find(
      (event) =>
        event.type === "terrain" && event.operation === "transmute",
    );
    expect(
      transmutation?.type === "terrain"
        ? transmutation.changedCells
        : 0,
    ).toBeGreaterThan(0);
    expect(
      result.eventLog.filter(
        (event) => event.type === "node" && event.role === "crystal-tip",
      ),
    ).toHaveLength(6);
  },
  magmaForge: (result) => {
    const construction = result.eventLog.find(
      (event) => event.type === "terrain" && event.operation === "fill",
    );
    expect(
      construction?.type === "terrain"
        ? construction.changedCells
        : 0,
    ).toBeGreaterThan(0);
    expect(
      result.eventLog.filter(
        (event) => event.type === "node" && event.role === "ejecta",
      ),
    ).toHaveLength(6);
  },
  faultChoir: (result) => {
    expect(
      result.eventLog.filter(
        (event) => event.type === "node" && event.role === "fault",
      ),
    ).toHaveLength(5);
    expect(
      result.eventLog.some(
        (event) =>
          event.type === "terrain" && event.operation === "settle",
      ),
    ).toBe(true);
  },
  auroraCage: (result) => {
    expect(
      result.eventLog.filter(
        (event) => event.type === "node" && event.role === "anchor",
      ),
    ).toHaveLength(3);
    expect(
      result.eventLog.some((event) => event.type === "tank-damaged"),
    ).toBe(true);
  },
  novaRing: (result) => {
    expect(
      result.eventLog.some(
        (event) =>
          event.type === "terrain" &&
          event.operation === "annular-carve",
      ),
    ).toBe(true);
    expect(result.terrain.get(110, 80)).not.toBe(Material.Empty);
    expect(result.terrain.get(110 + 82, 80)).toBe(Material.Empty);
  },
};

describe("Experimental Ultimates registry", () => {
  it("keeps exactly ten typed experiments outside the canonical 33", () => {
    expect(EXPERIMENTAL_ULTIMATES).toHaveLength(10);
    expect(EXPERIMENTAL_ULTIMATES.map(({ id }) => id)).toEqual(
      EXPERIMENTAL_ULTIMATE_IDS,
    );
    expect(WEAPONS).toHaveLength(33);
    expect(WEAPON_IDS).toHaveLength(33);
    expect(
      EXPERIMENTAL_ULTIMATE_IDS.some((id) =>
        (WEAPON_IDS as readonly string[]).includes(id),
      ),
    ).toBe(false);

    for (const ultimate of EXPERIMENTAL_ULTIMATES) {
      expect("catalogPrice" in ultimate).toBe(false);
      expect("catalogBundleSize" in ultimate).toBe(false);
      expect("armsLevel" in ultimate).toBe(false);
      expect(ultimate.distinguishingAxes.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("defines bounded quality budgets and explicit mechanical footprints", () => {
    expect(EXPERIMENTAL_PARTICLE_CAPS).toEqual({
      desktop: 600,
      phone: 250,
      reduced: 80,
    });

    for (const ultimate of EXPERIMENTAL_ULTIMATES) {
      expect(ultimate.footprint.mechanicalRadius).toBeGreaterThan(0);
      expect(ultimate.footprint.spectacleRadius).toBeGreaterThan(
        ultimate.footprint.mechanicalRadius,
      );
      expect(ultimate.quality.full.particles).toBeLessThanOrEqual(
        EXPERIMENTAL_PARTICLE_CAPS.desktop,
      );
      expect(ultimate.quality.reduced.particles).toBeLessThanOrEqual(
        EXPERIMENTAL_PARTICLE_CAPS.reduced,
      );
      expect(ultimate.quality.full.drawOperations).toBeGreaterThanOrEqual(
        ultimate.quality.balanced.drawOperations,
      );
      expect(ultimate.quality.balanced.drawOperations).toBeGreaterThanOrEqual(
        ultimate.quality.reduced.drawOperations,
      );
      expect(ultimate.aftermathMs).toBeLessThanOrEqual(4_000);
      expect(ultimate.resolutionMs).toBeLessThanOrEqual(5_000);
    }
  });
});

describe("Experimental cave support", () => {
  it("keeps a horizontally displaced cave tank on support below its depth", () => {
    const result = resolveExperimentalUltimate({
      ultimateId: "gravityCathedral",
      seed: "cave-displacement",
      origin: { x: 20, y: 40 },
      impact: { x: 150, y: 80 },
      direction: 1,
      terrain: makeCaveTerrain(),
      tanks: [
        {
          id: "cave",
          x: 70,
          y: 149,
          health: 100,
          maxHealth: 100,
        },
      ],
    });
    const tank = result.tanks[0];

    expect(tank?.health).toBeGreaterThan(0);
    expect(tank?.y).toBeGreaterThan(100);
    expect(
      result.terrain.firstSolidYAtOrBelow(
        tank?.x ?? 0,
        (tank?.y ?? 0) + 11,
      ),
    ).toBe((tank?.y ?? 0) + 11);
  });

  it("destroys a displaced tank when no support exists below it", () => {
    const terrain = new TerrainGrid(300, 220);
    const result = resolveExperimentalUltimate({
      ultimateId: "gravityCathedral",
      seed: "unsupported-displacement",
      origin: { x: 20, y: 40 },
      impact: { x: 150, y: 20 },
      direction: 1,
      terrain,
      tanks: [
        {
          id: "unsupported",
          x: 30,
          y: 170,
          health: 100,
          maxHealth: 100,
        },
      ],
    });
    const tank = result.tanks[0];

    expect(tank?.health).toBe(0);
    expect(tank?.y).toBeGreaterThan(terrain.height);
    expect(
      result.eventLog.some(
        (event) =>
          event.type === "tank-damaged" &&
          event.tankId === "unsupported" &&
          event.remainingHealth === 0,
      ),
    ).toBe(true);
  });
});

describe.each(EXPERIMENTAL_ULTIMATE_IDS)(
  "deterministic Experimental resolution: %s",
  (ultimateId) => {
    it("replays input + seed into the same event log and final state", () => {
      const initialTerrain = makeTerrain();
      const initialCells = initialTerrain.cells.slice();
      const definition = getExperimentalUltimate(ultimateId);
      const input = {
        ultimateId,
        seed: definition.testSeed,
        origin: { x: 28, y: 62 },
        impact: { x: 110, y: 80 },
        direction: 1 as const,
        terrain: initialTerrain,
        tanks: [
          {
            id: "near",
            x: 105,
            y: 69,
            health: 100,
            maxHealth: 100,
          },
          {
            id: "ring",
            x: 166,
            y: 69,
            health: 100,
            maxHealth: 100,
          },
        ],
      };

      const first = resolveExperimentalUltimate(input);
      const replay = resolveExperimentalUltimate(input);

      expect(first.eventLog).toEqual(replay.eventLog);
      expect(first.tanks).toEqual(replay.tanks);
      expect(first.terrain.cells).toEqual(replay.terrain.cells);
      expect(initialTerrain.cells).toEqual(initialCells);
      expect(first.eventLog.at(-1)).toEqual({
        type: "resolved",
        atMs: definition.resolutionMs,
        ultimateId,
      });
      expect(first.mechanicPoints.length).toBeGreaterThan(0);
      expect(changedCellCount(initialTerrain, first.terrain)).toBeGreaterThan(
        0,
      );
      STRATEGY_ASSERTIONS[ultimateId](first);
    });

    it("does not accept a presentation tier and therefore has one outcome", () => {
      const result = resolve(ultimateId);
      const eventTypes = result.eventLog.map((event) => event.type);

      expect(eventTypes[0]).toBe("phase");
      expect(eventTypes.at(-1)).toBe("resolved");
      expect(
        result.eventLog.filter((event) => event.type === "resolved"),
      ).toHaveLength(1);
    });
  },
);
