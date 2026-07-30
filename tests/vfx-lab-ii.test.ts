import { describe, expect, it } from "vitest";

import {
  createVfxLabRenderResources,
  drawVfxLabStage,
} from "../app/game/vfx-lab-ii-presentation";
import {
  EXPERIMENTAL_PRESENTATIONS,
  EXPERIMENTAL_SHOWCASE,
  EXPERIMENTAL_SHOWCASE_IDS,
  EXPERIMENTAL_ULTIMATES,
  Material,
  TerrainGrid,
  VFX_LAB_II_IDS,
  VFX_LAB_II_WEAPONS,
  WEAPONS,
  getExperimentalPresentation,
  getVfxLabWeapon,
  measuredDecorativeCoverage,
  presentationFrameTelemetry,
  resolveVfxLabWeapon,
  type ExperimentalEffectLevel,
  type PresentationDrawStage,
  type VfxLabWeaponId,
} from "../lib/game";

function terrain(): TerrainGrid {
  const grid = new TerrainGrid(240, 160);
  for (let y = 80; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      grid.set(x, y, y > 150 ? Material.Rock : Material.Soil);
    }
  }
  return grid;
}

function resolve(weaponId: VfxLabWeaponId) {
  return resolveVfxLabWeapon({
    weaponId,
    seed: getVfxLabWeapon(weaponId).testSeed,
    origin: { x: 30, y: 55 },
    impact: { x: 120, y: 80 },
    direction: 1,
    terrain: terrain(),
    tanks: [
      {
        id: "outside",
        x: 170,
        y: 70,
        health: 100,
        maxHealth: 100,
      },
    ],
  });
}

describe("VFX Lab II registries", () => {
  it("keeps canonical 33, original Ultimates 10 and exactly ten new IDs", () => {
    expect(WEAPONS).toHaveLength(33);
    expect(EXPERIMENTAL_ULTIMATES).toHaveLength(10);
    expect(VFX_LAB_II_WEAPONS).toHaveLength(10);
    expect(VFX_LAB_II_WEAPONS.map(({ id }) => id)).toEqual(VFX_LAB_II_IDS);
    expect(EXPERIMENTAL_SHOWCASE).toHaveLength(20);
    expect(EXPERIMENTAL_SHOWCASE_IDS).toHaveLength(20);
    expect(new Set(EXPERIMENTAL_SHOWCASE_IDS).size).toBe(20);
  });

  it("keeps presentation classes typed, mechanics-independent and unique", () => {
    expect(EXPERIMENTAL_PRESENTATIONS).toHaveLength(20);
    expect(
      EXPERIMENTAL_PRESENTATIONS.map(({ weaponId }) => weaponId),
    ).toEqual(EXPERIMENTAL_SHOWCASE_IDS);

    const classes = VFX_LAB_II_IDS.map(
      (weaponId) =>
        getExperimentalPresentation(weaponId).presentationClass,
    );
    expect(new Set(classes).size).toBe(10);
    for (const presentation of EXPERIMENTAL_PRESENTATIONS) {
      expect("strategy" in presentation).toBe(false);
      expect("mechanicalRadius" in presentation).toBe(false);
      expect(presentation.minimapCue).toBe("mechanic-footprint-only");
    }
  });

  it("uses all five draw stages without making particles a visual oracle", () => {
    const stages = new Set(
      VFX_LAB_II_IDS.flatMap(
        (weaponId) => getExperimentalPresentation(weaponId).stages,
      ),
    );
    expect(stages).toEqual(
      new Set<PresentationDrawStage>([
        "behindWorld",
        "worldUnderlay",
        "worldOverlay",
        "foreground",
        "screenSpace",
      ]),
    );
    for (const weaponId of VFX_LAB_II_IDS) {
      const presentation = getExperimentalPresentation(weaponId);
      expect(presentation.particlesOptional).toBe(true);
      expect(presentation.signaturePrimitives.length).toBeGreaterThanOrEqual(2);
      expect(
        presentation.signaturePrimitives.some((primitive) =>
          primitive.toLowerCase().includes("particle"),
        ),
      ).toBe(false);
      expect(presentation.budget.reduced.particles).toBe(0);
    }
  });
});

describe("VFX Lab II budgets, coverage and accessibility", () => {
  it.each(VFX_LAB_II_IDS)(
    "%s has bounded Full/Balanced/Reduced budgets",
    (weaponId) => {
      const presentation = getExperimentalPresentation(weaponId);
      const { full, balanced, reduced } = presentation.budget;
      expect(full.drawOperations).toBeGreaterThanOrEqual(
        balanced.drawOperations,
      );
      expect(balanced.drawOperations).toBeGreaterThanOrEqual(
        reduced.drawOperations,
      );
      expect(full.offscreenCanvases).toBeLessThanOrEqual(1);
      expect(full.offscreenPixels).toBeLessThanOrEqual(518_400);
      expect(full.sceneCaptures).toBeLessThanOrEqual(1);
      expect(full.compositePasses).toBeLessThanOrEqual(3);
      expect(full.activeFlipbookLayers).toBeLessThanOrEqual(3);
      expect(full.audioVoices).toBeLessThanOrEqual(7);
      expect(reduced.sceneCaptures).toBe(0);
      expect(reduced.offscreenPixels).toBe(0);
      expect(reduced.screenDistortion).toBe(false);
      expect(reduced.strongParallax).toBe(false);
      expect(reduced.cameraZoom).toBe(1);
      expect(reduced.shakePx).toBe(0);
      expect(presentation.accessibility.maxFlashesPerSecond).toBeLessThanOrEqual(
        3,
      );
      expect(
        presentation.accessibility.viewportLuminancePulses,
      ).toBeLessThanOrEqual(1);
      expect(
        presentation.accessibility.saturatedRedFullscreenFlash,
      ).toBe(false);
    },
  );

  it.each(VFX_LAB_II_IDS)(
    "%s covers at least 70% at the Full climax",
    (weaponId) => {
      const bounds =
        getExperimentalPresentation(weaponId).climaxBounds.full;
      expect(measuredDecorativeCoverage(bounds)).toBeGreaterThanOrEqual(0.7);
    },
  );

  it.each(VFX_LAB_II_IDS)(
    "%s exposes anticipation, climax and aftermath telemetry",
    (weaponId) => {
      const keyframes = [
        "anticipation",
        "climax",
        "aftermath",
      ] as const;
      for (const keyframe of keyframes) {
        const telemetry = presentationFrameTelemetry(
          weaponId,
          keyframe,
          "full",
        );
        expect(telemetry.activeStages.length).toBeGreaterThan(0);
        expect(telemetry.drawOperations).toBeGreaterThan(0);
        expect(telemetry.compositePasses).toBeGreaterThan(0);
      }
      expect(
        presentationFrameTelemetry(weaponId, "climax", "full")
          .decorativeCoverage,
      ).toBeGreaterThanOrEqual(0.7);
    },
  );
});

describe("VFX Lab II runtime quality routing", () => {
  it("forces the static no-capture fallback when reduced motion overrides Full", () => {
    const calls = { strokeRect: 0 };
    const context = {
      save() {},
      restore() {},
      beginPath() {},
      arc() {},
      stroke() {},
      fill() {},
      strokeRect() {
        calls.strokeRect += 1;
      },
    } as unknown as CanvasRenderingContext2D;
    const sharedOptions = {
      context,
      stage: "screenSpace" as const,
      shot: {
        weaponId: "pixelUndertow",
        seed: 62_806,
        elapsedMs: 1_200,
        duration: 3_040,
        finalPoint: { x: 120, y: 80 },
      },
      effectLevel: "full" as const,
      viewport: { width: 960, height: 540, dpr: 1 },
      cameraBounds: { left: 0, top: 0, width: 960, height: 540 },
      impactScreen: { x: 480, y: 270 },
    };

    const reducedResources = createVfxLabRenderResources();
    drawVfxLabStage({
      ...sharedOptions,
      reducedMotion: true,
      resources: reducedResources,
    });
    expect(calls.strokeRect).toBe(1);
    expect(reducedResources.sceneCaptures).toBe(0);
    expect(reducedResources.snapshot).toBeNull();

    calls.strokeRect = 0;
    drawVfxLabStage({
      ...sharedOptions,
      reducedMotion: false,
      resources: createVfxLabRenderResources(),
    });
    expect(calls.strokeRect).toBe(0);
  });
});

describe("VFX Lab II mechanics boundary", () => {
  it.each(VFX_LAB_II_IDS)(
    "%s is deterministic and stays inside the Missile-sized footprint",
    (weaponId) => {
      const definition = getVfxLabWeapon(weaponId);
      const before = terrain();
      const first = resolve(weaponId);
      const replay = resolve(weaponId);

      expect(definition.footprint.mechanicalRadius).toBeLessThanOrEqual(34);
      expect(first.eventLog).toEqual(replay.eventLog);
      expect(first.tanks).toEqual(replay.tanks);
      expect(first.terrain.cells).toEqual(replay.terrain.cells);
      expect(first.tanks[0]?.health).toBe(100);
      expect(first.durationMs).toBe(
        definition.resolutionMs + definition.aftermathMs,
      );
      expect(first.eventLog.map((event) => event.type)).toContain("terrain");
      expect(
        first.eventLog.some(
          (event) =>
            event.type === "phase" && event.phase === "anticipation",
        ),
      ).toBe(true);
      expect(
        first.eventLog.some(
          (event) =>
            event.type === "phase" && event.phase === "culmination",
        ),
      ).toBe(true);
      expect(
        first.eventLog.some(
          (event) => event.type === "phase" && event.phase === "aftermath",
        ),
      ).toBe(true);

      for (let y = 0; y < before.height; y += 1) {
        for (let x = 0; x < before.width; x += 1) {
          if (before.get(x, y) === first.terrain.get(x, y)) {
            continue;
          }
          expect(Math.hypot(x + 0.5 - 120, y + 0.5 - 80)).toBeLessThanOrEqual(
            definition.footprint.mechanicalRadius + 0.8,
          );
        }
      }
    },
  );

  it.each(VFX_LAB_II_IDS)(
    "%s has one mechanical outcome for all presentation tiers",
    (weaponId) => {
      const outcomes = (
        ["full", "balanced", "reduced"] as const satisfies readonly ExperimentalEffectLevel[]
      ).map((level) => {
        const result = resolve(weaponId);
        const telemetry = presentationFrameTelemetry(
          weaponId,
          "climax",
          level,
        );
        return {
          terrain: [...result.terrain.cells],
          tanks: result.tanks,
          mechanics: result.eventLog,
          presentationOnly: telemetry.effectLevel,
        };
      });
      expect(outcomes[0]?.terrain).toEqual(outcomes[1]?.terrain);
      expect(outcomes[1]?.terrain).toEqual(outcomes[2]?.terrain);
      expect(outcomes[0]?.tanks).toEqual(outcomes[2]?.tanks);
      expect(outcomes[0]?.mechanics).toEqual(outcomes[2]?.mechanics);
      expect(outcomes.map(({ presentationOnly }) => presentationOnly)).toEqual([
        "full",
        "balanced",
        "reduced",
      ]);
    },
  );
});
