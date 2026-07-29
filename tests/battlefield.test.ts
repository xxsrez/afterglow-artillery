import { describe, expect, it } from "vitest";

import {
  BATTLEFIELD_LAYOUT_MOTIFS,
  BATTLEFIELD_LAYOUT_MOTIFS_BY_PROFILE,
  DEFAULT_BATTLEFIELD_LAYOUT_RULES,
  Material,
  TerrainGrid,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  battlefieldGridHash,
  createBattlefieldPlan,
  generateBattlefield,
  generateTerrain,
  measureBattlefieldStructure,
  mirrorInvariantSilhouetteDistance,
  type BattlefieldLayoutMotif,
  type BattlefieldLayoutProfile,
} from "../lib/game/index";

function countSurfaceDetail(terrain: TerrainGrid): {
  range: number;
  localChanges: number;
} {
  const surfaces = Array.from({ length: terrain.width }, (_, x) =>
    terrain.surfaceY(x),
  ).filter((value): value is number => value !== null);
  let localChanges = 0;

  for (let x = 8; x < surfaces.length; x += 8) {
    if (Math.abs((surfaces[x] as number) - (surfaces[x - 8] as number)) >= 2) {
      localChanges += 1;
    }
  }

  return {
    range: Math.max(...surfaces) - Math.min(...surfaces),
    localChanges,
  };
}

function countSurfaceConnectedCaveCells(terrain: TerrainGrid): number {
  const queue = new Int32Array(terrain.cells.length);
  const visited = new Uint8Array(terrain.cells.length);
  let head = 0;
  let tail = 0;

  for (let x = 0; x < terrain.width; x += 1) {
    if (terrain.get(x, 0) === Material.Empty) {
      const index = x;
      queue[tail] = index;
      tail += 1;
      visited[index] = 1;
    }
  }

  let buriedCells = 0;

  while (head < tail) {
    const index = queue[head] as number;
    head += 1;
    const x = index % terrain.width;
    const y = Math.floor(index / terrain.width);
    const surface = terrain.surfaceY(x);

    if (surface !== null && y > surface + 8) {
      buriedCells += 1;
    }

    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < terrain.width ? index + 1 : -1,
      y > 0 ? index - terrain.width : -1,
      y + 1 < terrain.height ? index + terrain.width : -1,
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor < 0 ||
        visited[neighbor] === 1 ||
        terrain.cells[neighbor] !== Material.Empty
      ) {
        continue;
      }

      visited[neighbor] = 1;
      queue[tail] = neighbor;
      tail += 1;
    }
  }

  return buriedCells;
}

function countOverhangColumns(terrain: TerrainGrid): number {
  let columns = 0;

  for (let x = 0; x < terrain.width; x += 1) {
    const surface = terrain.surfaceY(x);
    if (surface === null) {
      continue;
    }

    let foundAirBelowMaterial = false;

    for (let y = surface + 1; y < terrain.height - 2; y += 1) {
      if (terrain.get(x, y) === Material.Empty) {
        foundAirBelowMaterial = true;
      } else if (foundAirBelowMaterial) {
        columns += 1;
        break;
      }
    }
  }

  return columns;
}

describe("large battlefield generation", () => {
  it("separates the fixed viewport from a substantially larger world", () => {
    const battlefield = generateBattlefield("full-world-dimensions");

    expect(VIEWPORT_WIDTH).toBe(960);
    expect(VIEWPORT_HEIGHT).toBe(540);
    expect(WORLD_WIDTH).toBe(2_880);
    expect(WORLD_HEIGHT).toBe(720);
    expect(WORLD_WIDTH).toBe(VIEWPORT_WIDTH * 3);
    expect(WORLD_HEIGHT).toBeGreaterThan(VIEWPORT_HEIGHT);
    expect(battlefield.terrain.width).toBe(WORLD_WIDTH);
    expect(battlefield.terrain.height).toBe(WORLD_HEIGHT);
  });

  it("replays terrain and spawn preparation exactly from the same seed", () => {
    const options = {
      width: 840,
      height: 360,
      minSurfaceY: 130,
      maxSurfaceY: 235,
      caveCount: 7,
      tunnelCount: 10,
      bedrockDepth: 22,
      spawnPadHalfWidth: 18,
    } as const;
    const first = generateBattlefield("deterministic-caverns", options);
    const replay = generateBattlefield("deterministic-caverns", options);
    const different = generateBattlefield("different-caverns", options);

    expect(first.plan).toEqual(replay.plan);
    expect(first.metadata).toEqual(replay.metadata);
    expect(first.spawns).toEqual(replay.spawns);
    expect(battlefieldGridHash(first.terrain)).toBe(
      battlefieldGridHash(replay.terrain),
    );
    expect(battlefieldGridHash(first.terrain)).not.toBe(
      battlefieldGridHash(different.terrain),
    );
  });

  it("keeps all four plan profiles represented and avoids a three-round repeat", () => {
    const counts: Record<BattlefieldLayoutProfile, number> = {
      open: 0,
      ridge: 0,
      valley: 0,
      cavern: 0,
    };

    for (let seed = 0; seed < 512; seed += 1) {
      const profiles = [1, 2, 3].map(
        (roundNumber) =>
          createBattlefieldPlan(seed, { roundNumber }).profile,
      );
      counts[profiles[0] as BattlefieldLayoutProfile] += 1;
      expect(new Set(profiles).size).toBeGreaterThan(1);
    }

    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThanOrEqual(Math.ceil(512 * 0.15));
      expect(count).toBeLessThanOrEqual(512 * 0.5);
    }
  });

  it.each([
    ["open-shelf", "open"],
    ["ridge-shelf", "ridge"],
    ["valley-shelf", "valley"],
  ] as const)(
    "places seed %s on distant safe surface shelves for %s",
    (seed, layoutProfile) => {
      const tankHalfHeight = 11;
      const padHalfWidth = 20;
      const battlefield = generateBattlefield(seed, {
        layoutProfile,
        width: 1_200,
        height: 420,
        minSurfaceY: 150,
        maxSurfaceY: 285,
        caveCount: 8,
        tunnelCount: 12,
        bedrockDepth: 24,
        minSpawnSeparation: 624,
        spawnPadHalfWidth: padHalfWidth,
        tankHalfHeight,
      });
      const [left, right] = battlefield.spawns;

      expect(battlefield.plan.profile).toBe(layoutProfile);
      expect(left.kind).toBe("surface");
      expect(right.kind).toBe("surface");
      expect(left.x).toBeLessThanOrEqual(battlefield.terrain.width * 0.33);
      expect(right.x).toBeGreaterThanOrEqual(battlefield.terrain.width * 0.67);
      expect(right.x - left.x).toBeGreaterThanOrEqual(624);

      for (const spawn of battlefield.spawns) {
        const supportY = spawn.y + tankHalfHeight;

        for (
          let x = spawn.x - padHalfWidth;
          x <= spawn.x + padHalfWidth;
          x += 1
        ) {
          expect(battlefield.terrain.surfaceY(x)).toBe(supportY);

          for (let y = supportY - 20; y < supportY; y += 1) {
            expect(battlefield.terrain.get(x, y)).toBe(Material.Empty);
          }

          for (let y = supportY; y < supportY + 12; y += 1) {
            expect(battlefield.terrain.isSolid(x, y)).toBe(true);
          }
        }
      }
    },
  );

  it.each([
    ["cavern-fixture-0", "surface-vs-cave", ["surface", "cave"]],
    ["cavern-fixture-1", "cave-vs-cave", ["cave", "cave"]],
  ] as const)(
    "creates a playable %s cavern layout for %s",
    (seed, variant, expectedKinds) => {
      const padHalfWidth = 24;
      const tankHalfHeight = 11;
      const battlefield = generateBattlefield(seed, {
        layoutProfile: "cavern",
        spawnPadHalfWidth: padHalfWidth,
        tankHalfHeight,
      });

      expect(battlefield.plan.cavernVariant).toBe(variant);
      expect(battlefield.spawns.map((spawn) => spawn.kind)).toEqual(
        expectedKinds,
      );
      expect(battlefield.metadata.fallbackReason).toBeNull();

      battlefield.spawns.forEach((spawn, index) => {
        const supportY = spawn.y + tankHalfHeight;
        const metadata = battlefield.metadata.spawns[index] as
          | (typeof battlefield.metadata.spawns)[number]
          | undefined;
        expect(metadata).toBeDefined();
        expect(metadata?.supportDepth).toBeGreaterThanOrEqual(12);

        if (spawn.kind === "surface") {
          expect(battlefield.terrain.surfaceY(spawn.x)).toBe(supportY);
          expect(metadata?.openSky).toBe(true);
          return;
        }

        expect(
          battlefield.terrain.firstSolidYAtOrBelow(
            spawn.x,
            supportY - 1,
          ),
        ).toBe(supportY);
        expect(battlefield.terrain.surfaceY(spawn.x)).toBeLessThan(
          spawn.y,
        );
        expect(metadata?.headroom).toBeGreaterThanOrEqual(
          tankHalfHeight * 3,
        );
        expect(metadata?.roofThickness).toBeGreaterThanOrEqual(
          WORLD_HEIGHT * 0.035,
        );
        expect(metadata?.mouthConnected).toBe(true);
        expect(metadata?.firingExit).toBe(true);

        for (
          let x = spawn.x - padHalfWidth;
          x <= spawn.x + padHalfWidth;
          x += 1
        ) {
          expect(
            battlefield.terrain.firstSolidYAtOrBelow(x, supportY - 1),
          ).toBe(supportY);
        }
      });
    },
  );

  it.each([
    "profile-a",
    "profile-b",
    "profile-c",
  ])(
    "preserves full-size tactical topology for fixture family %s",
    (fixture) => {
      for (const profile of [
        "open",
        "ridge",
        "valley",
        "cavern",
      ] as const) {
        const battlefield = generateBattlefield(`${fixture}-${profile}`, {
          layoutProfile: profile,
        });

        expect(battlefield.plan.profile).toBe(profile);
        expect(battlefield.metadata.fallbackReason).toBeNull();
        expect(battlefield.metadata.attempt).toBeLessThanOrEqual(4);
        expect(
          battlefield.metadata.topology.horizontalSeparation,
        ).toBeGreaterThanOrEqual(
          Math.round(
            WORLD_WIDTH * battlefield.plan.minSpawnSeparationRatio,
          ),
        );

        if (profile === "ridge") {
          expect(battlefield.metadata.topology.ridgeHeight).toBeGreaterThanOrEqual(
            WORLD_HEIGHT * 0.1,
          );
          expect(battlefield.metadata.topology.featureWidth).toBeGreaterThanOrEqual(
            160,
          );
        } else if (
          profile === "valley" &&
          battlefield.plan.motif !== "split-chasm"
        ) {
          expect(battlefield.metadata.topology.basinDepth).toBeGreaterThanOrEqual(
            WORLD_HEIGHT * 0.1,
          );
          expect(battlefield.metadata.topology.featureWidth).toBeGreaterThanOrEqual(
            160,
          );
        } else if (profile === "cavern") {
          expect(
            battlefield.spawns.some((spawn) => spawn.kind === "cave"),
          ).toBe(true);
        }
      }
    },
  );

  it("realizes every motif as a validated composition with blind structural separation", () => {
    const structures = new Map<
      BattlefieldLayoutMotif,
      ReturnType<typeof measureBattlefieldStructure>
    >();

    for (const motif of BATTLEFIELD_LAYOUT_MOTIFS) {
      const battlefield = generateBattlefield("motif-comparison-seed", {
        layoutMotif: motif,
      });

      expect(battlefield.plan.motif).toBe(motif);
      expect(battlefield.metadata.motif).toBe(motif);
      expect(battlefield.metadata.fallbackReason).toBeNull();
      expect(battlefield.metadata.structure).toEqual(
        measureBattlefieldStructure(battlefield.terrain),
      );
      structures.set(motif, battlefield.metadata.structure);

      if (motif === "island-chain" || motif === "asymmetric-slope") {
        expect(
          battlefield.metadata.structure.floatingSolidComponentCount,
        ).toBeGreaterThanOrEqual(1);
      }
      if (motif === "asymmetric-slope") {
        expect(
          battlefield.metadata.topology.verticalSeparation,
        ).toBeGreaterThanOrEqual(WORLD_HEIGHT * 0.3);
      }
      if (motif === "broken-plateaus" || motif === "fortress-mesa") {
        expect(
          battlefield.metadata.structure.cliffCount,
        ).toBeGreaterThanOrEqual(2);
      }
      if (motif === "buried-duel" || motif === "underworld") {
        expect(
          battlefield.metadata.structure.undergroundOpenAirSpan,
        ).toBeGreaterThanOrEqual(WORLD_WIDTH * 0.55);
        expect(
          battlefield.spawns.every((spawn) => spawn.kind === "cave"),
        ).toBe(true);
      }
    }

    for (const motifs of Object.values(
      BATTLEFIELD_LAYOUT_MOTIFS_BY_PROFILE,
    )) {
      for (let left = 0; left < motifs.length; left += 1) {
        for (let right = left + 1; right < motifs.length; right += 1) {
          const leftStructure = structures.get(
            motifs[left] as BattlefieldLayoutMotif,
          );
          const rightStructure = structures.get(
            motifs[right] as BattlefieldLayoutMotif,
          );
          expect(leftStructure).toBeDefined();
          expect(rightStructure).toBeDefined();
          expect(
            mirrorInvariantSilhouetteDistance(
              leftStructure?.surfaceSilhouette ?? [],
              rightStructure?.surfaceSilhouette ?? [],
            ),
          ).toBeGreaterThan(0.035);
        }
      }
    }
  });

  it("keeps motif geometry authoritative over the legacy random cave pass", () => {
    const generated = generateBattlefield("noise-contract", {
      layoutMotif: "central-spire",
    });
    const explicitNoCaves = generateBattlefield("noise-contract", {
      layoutMotif: "central-spire",
      caveCount: 0,
      tunnelCount: 0,
    });
    const explicitlyInjectedCaves = generateBattlefield(
      "noise-contract",
      {
        layoutMotif: "central-spire",
        caveCount: 8,
        tunnelCount: 12,
      },
    );

    expect(battlefieldGridHash(generated.terrain)).toBe(
      battlefieldGridHash(explicitNoCaves.terrain),
    );
    expect(battlefieldGridHash(generated.terrain)).not.toBe(
      battlefieldGridHash(explicitlyInjectedCaves.terrain),
    );
  });

  it("measures rendered feature width instead of trusting the plan envelope", () => {
    const battlefield = generateBattlefield("measured-width", {
      layoutMotif: "central-spire",
    });
    const compatibilityEnvelope = Math.round(
      battlefield.plan.macro.widthRatio * battlefield.terrain.width,
    );

    expect(battlefield.metadata.topology.featureWidth).toBeGreaterThanOrEqual(
      160,
    );
    expect(battlefield.metadata.topology.featureWidth).not.toBe(
      compatibilityEnvelope,
    );
  });

  it("never silently replaces an exact motif override with another motif", () => {
    expect(() =>
      generateBattlefield("impossible-exact-motif", {
        layoutMotif: "central-spire",
        layoutRules: {
          ...DEFAULT_BATTLEFIELD_LAYOUT_RULES,
          minFeatureHeightRatio: 0.9,
          minFeatureWidth: 10_000,
        },
      }),
    ).toThrowError(
      "Unable to validate exact battlefield motif central-spire: ridge-topology.",
    );
  });

  it("keeps every exact motif valid across a scaled deterministic seed sweep", () => {
    for (const motif of BATTLEFIELD_LAYOUT_MOTIFS) {
      for (let seed = 0; seed < 4; seed += 1) {
        const battlefield = generateBattlefield(
          `scaled-motif-${seed}`,
          {
            layoutMotif: motif,
            width: 960,
            height: 360,
          },
        );

        expect(battlefield.plan.motif).toBe(motif);
        expect(battlefield.metadata.motif).toBe(motif);
        expect(battlefield.metadata.fallbackReason).toBeNull();
      }
    }
  });

  it("keeps retries bounded with a low deterministic fallback rate", () => {
    let fallbackCount = 0;
    let totalAttempts = 0;

    for (let seed = 0; seed < 64; seed += 1) {
      const battlefield = generateBattlefield(`retry-${seed}`, {
        width: 960,
        height: 360,
      });
      totalAttempts += battlefield.metadata.attempt;
      if (battlefield.metadata.fallbackReason !== null) {
        fallbackCount += 1;
      }
    }

    expect(fallbackCount / 64).toBeLessThan(0.05);
    expect(totalAttempts / 64).toBeLessThan(2);
  });

  it.each(["caves-alpha", "caves-beta", "caves-gamma"])(
    "creates detailed surface, connected cave mouths and overhangs for %s",
    (seed) => {
      const bedrockDepth = 20;
      const terrain = generateTerrain(seed, {
        width: 900,
        height: 380,
        minSurfaceY: 135,
        maxSurfaceY: 245,
        controlPointSpacing: 90,
        roughness: 58,
        caveCount: 9,
        tunnelCount: 13,
        bedrockDepth,
      });
      const detail = countSurfaceDetail(terrain);

      expect(detail.range).toBeGreaterThan(35);
      expect(detail.localChanges).toBeGreaterThan(12);
      expect(countSurfaceConnectedCaveCells(terrain)).toBeGreaterThan(900);
      expect(countOverhangColumns(terrain)).toBeGreaterThan(70);

      for (
        let y = terrain.height - bedrockDepth;
        y < terrain.height;
        y += 1
      ) {
        for (let x = 0; x < terrain.width; x += 11) {
          expect(terrain.get(x, y)).toBe(Material.Rock);
        }
      }
    },
  );
});

describe("TerrainGrid support queries", () => {
  it("finds the first floor at or below a requested cave height", () => {
    const terrain = new TerrainGrid(12, 18);
    terrain.set(4, 3, Material.Soil);
    terrain.set(4, 10, Material.Rock);
    terrain.set(4, 11, Material.Rock);

    expect(terrain.firstSolidYAtOrBelow(4, -20)).toBe(3);
    expect(terrain.firstSolidYAtOrBelow(4, 3)).toBe(3);
    expect(terrain.firstSolidYAtOrBelow(4, 4)).toBe(10);
    expect(terrain.firstSolidYAtOrBelow(4, 10.9)).toBe(10);
    expect(terrain.firstSolidYAtOrBelow(4, 12)).toBeNull();
    expect(terrain.firstSolidYAtOrBelow(-1, 0)).toBeNull();
    expect(terrain.firstSolidYAtOrBelow(4, terrain.height)).toBeNull();
  });
});
