import { describe, expect, it } from "vitest";

import {
  MOBILE_FIRE_HOLD_MS,
  cameraCenterForOccludedTarget,
  clientPointToViewport,
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

  it("uses an in-range hold and cancels once a pointer leaves Fire", () => {
    expect(MOBILE_FIRE_HOLD_MS).toBeGreaterThanOrEqual(300);
    expect(MOBILE_FIRE_HOLD_MS).toBeLessThanOrEqual(450);
    const rect = { left: 10, top: 20, width: 84, height: 56 };
    expect(pointInsideRect(52, 48, rect)).toBe(true);
    expect(pointInsideRect(95, 48, rect)).toBe(false);
  });
});
