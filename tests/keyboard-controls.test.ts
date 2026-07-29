import { describe, expect, it } from "vitest";

import {
  angleDeltaForScreenDirection,
  barrelEndX,
  getGameKeyboardAction,
  isAimingKeyboardOwner,
  isKeyboardControlTarget,
} from "../app/game/keyboard-controls";

const aimingContext = {
  phase: "aiming",
  settingsOpen: false,
  target: null,
} as const;

describe("game keyboard controls", () => {
  it("maps horizontal arrows to angle and vertical arrows to power", () => {
    expect(getGameKeyboardAction("ArrowLeft", aimingContext)).toEqual({
      type: "adjust-angle",
      screenDirection: -1,
    });
    expect(getGameKeyboardAction("ArrowRight", aimingContext)).toEqual({
      type: "adjust-angle",
      screenDirection: 1,
    });
    expect(getGameKeyboardAction("ArrowUp", aimingContext)).toEqual({
      type: "adjust-power",
      delta: 10,
    });
    expect(getGameKeyboardAction("ArrowDown", aimingContext)).toEqual({
      type: "adjust-power",
      delta: -10,
    });
  });

  it.each([
    { player: "left-facing tank", tankDirection: -1 as const },
    { player: "right-facing tank", tankDirection: 1 as const },
  ])(
    "moves the rendered barrel endpoint in screen space for the $player",
    ({ tankDirection }) => {
      const angleDegrees = 48;
      const originX = 480;
      const length = 25;
      const initialBarrelEndX = barrelEndX(
        originX,
        angleDegrees,
        tankDirection,
        length,
      );

      for (const [code, expectedScreenDirection] of [
        ["ArrowLeft", -1],
        ["ArrowRight", 1],
      ] as const) {
        const action = getGameKeyboardAction(code, aimingContext);

        expect(action?.type).toBe("adjust-angle");
        if (action?.type !== "adjust-angle") {
          throw new Error(`Expected an angle action for ${code}`);
        }

        const nextAngle =
          angleDegrees +
          angleDeltaForScreenDirection(
            action.screenDirection,
            tankDirection,
          );
        const nextBarrelEndX = barrelEndX(
          originX,
          nextAngle,
          tankDirection,
          length,
        );

        expect(Math.sign(nextBarrelEndX - initialBarrelEndX)).toBe(
          expectedScreenDirection,
        );
      }
    },
  );

  it("keeps weapon cycling, firing, and settings shortcuts available", () => {
    expect(getGameKeyboardAction("KeyQ", aimingContext)).toEqual({
      type: "cycle-weapon",
      direction: -1,
    });
    expect(getGameKeyboardAction("KeyE", aimingContext)).toEqual({
      type: "cycle-weapon",
      direction: 1,
    });
    expect(getGameKeyboardAction("Space", aimingContext)).toEqual({
      type: "fire",
    });
    expect(getGameKeyboardAction("Enter", aimingContext)).toEqual({
      type: "fire",
    });
    expect(getGameKeyboardAction("KeyP", aimingContext)).toEqual({
      type: "toggle-settings",
    });
  });

  it("ignores aiming shortcuts while settings are open or outside aiming", () => {
    expect(
      getGameKeyboardAction("ArrowLeft", {
        ...aimingContext,
        settingsOpen: true,
      }),
    ).toBeNull();
    expect(
      getGameKeyboardAction("ArrowUp", {
        ...aimingContext,
        phase: "firing",
      }),
    ).toBeNull();
    expect(
      getGameKeyboardAction("KeyP", {
        ...aimingContext,
        phase: "firing",
      }),
    ).toEqual({ type: "toggle-settings" });
    expect(
      getGameKeyboardAction("KeyP", {
        ...aimingContext,
        settingsOpen: true,
      }),
    ).toEqual({ type: "toggle-settings" });
  });

  it.each(["input", "BUTTON", "Select", "textarea", "a"])(
    "ignores shortcuts from a %s control",
    (tagName) => {
      const target = { tagName } as unknown as EventTarget;

      expect(isKeyboardControlTarget(target)).toBe(true);
      expect(
        getGameKeyboardAction("ArrowRight", {
          ...aimingContext,
          target,
        }),
      ).toBeNull();
      expect(
        getGameKeyboardAction("KeyP", {
          ...aimingContext,
          target,
        }),
      ).toBeNull();
    },
  );

  it("allows only aiming arrows from the focused weapon trigger", () => {
    const target = {
      tagName: "button",
      getAttribute: (name: string) =>
        name === "data-game-keyboard-owner" ? "aiming" : null,
    } as unknown as EventTarget;

    expect(isKeyboardControlTarget(target)).toBe(true);
    expect(isAimingKeyboardOwner(target)).toBe(true);
    expect(
      getGameKeyboardAction("ArrowRight", {
        ...aimingContext,
        target,
      }),
    ).toEqual({
      type: "adjust-angle",
      screenDirection: 1,
    });
    expect(
      getGameKeyboardAction("ArrowUp", {
        ...aimingContext,
        target,
      }),
    ).toEqual({ type: "adjust-power", delta: 10 });
    expect(
      getGameKeyboardAction("Enter", {
        ...aimingContext,
        target,
      }),
    ).toBeNull();
    expect(
      getGameKeyboardAction("Space", {
        ...aimingContext,
        target,
      }),
    ).toBeNull();
  });
});
