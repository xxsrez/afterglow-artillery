import { describe, expect, it } from "vitest";

import {
  AIM_HOLD_DELAY_MS,
  AIM_HOLD_INITIAL_STEPS_PER_SECOND,
  AIM_HOLD_MAX_STEPS_PER_SECOND,
  aimHoldStepsPerSecond,
  cameraCenterForOccludedTarget,
  clientPointToViewport,
  fitCombatViewport,
  isMobileCombatViewport,
  pointInsideRect,
} from "../app/game/mobile-combat";

describe("mobile combat geometry", () => {
  it("selects the dedicated layout by actual stage width or height", () => {
    expect(isMobileCombatViewport({ width: 844, height: 390 })).toBe(true);
    expect(isMobileCombatViewport({ width: 1_280, height: 430 })).toBe(true);
    expect(isMobileCombatViewport({ width: 932, height: 700 })).toBe(true);
    expect(isMobileCombatViewport({ width: 1_280, height: 720 })).toBe(false);
  });

  it("maps the measured gameplay rect without contain letterboxing", () => {
    expect(
      clientPointToViewport(
        422,
        160,
        { left: 0, top: 0, width: 844, height: 320 },
        { width: 844, height: 320 },
      ),
    ).toEqual({ x: 422, y: 160 });
  });

  it("fits expanded iPhone browser chrome instead of leaving controls below it", () => {
    expect(
      fitCombatViewport(
        { width: 844, height: 390 },
        { width: 844, height: 320 },
      ),
    ).toEqual({ width: 844, height: 320 });
    expect(
      fitCombatViewport(
        { width: 844, height: 320 },
        { width: 844, height: 390 },
      ),
    ).toEqual({ width: 844, height: 320 });
  });

  it("composes a target in the free frame between HUD occlusions", () => {
    expect(
      cameraCenterForOccludedTarget(
        { x: 1_400, y: 500 },
        { width: 844, height: 320 },
        { top: 48, right: 0, bottom: 64, left: 0 },
        1,
      ),
    ).toEqual({ x: 1_400, y: 508 });
  });

  it("distinguishes an in-range Fire release from a dragged-out tap", () => {
    const rect = { left: 10, top: 20, width: 84, height: 56 };
    expect(pointInsideRect(52, 48, rect)).toBe(true);
    expect(pointInsideRect(95, 48, rect)).toBe(false);
  });

  it("delays held aim repetition, then accelerates to a bounded rate", () => {
    expect(aimHoldStepsPerSecond(AIM_HOLD_DELAY_MS - 1)).toBe(0);
    expect(aimHoldStepsPerSecond(AIM_HOLD_DELAY_MS)).toBe(
      AIM_HOLD_INITIAL_STEPS_PER_SECOND,
    );
    expect(aimHoldStepsPerSecond(AIM_HOLD_DELAY_MS + 700)).toBeGreaterThan(
      AIM_HOLD_INITIAL_STEPS_PER_SECOND,
    );
    expect(aimHoldStepsPerSecond(Number.POSITIVE_INFINITY)).toBe(0);
    expect(aimHoldStepsPerSecond(10_000)).toBe(
      AIM_HOLD_MAX_STEPS_PER_SECOND,
    );
  });
});
