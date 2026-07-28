// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
  getGameKeyboardAction,
  type GameKeyboardAction,
} from "../app/game/keyboard-controls";

afterEach(() => {
  document.body.replaceChildren();
});

function dispatchAimingKey(
  target: HTMLElement,
  code: string,
): {
  action: GameKeyboardAction | null;
  defaultPrevented: boolean;
} {
  let action: GameKeyboardAction | null = null;
  const onKeyDown = (event: KeyboardEvent) => {
    action = getGameKeyboardAction(event.code, {
      phase: "aiming",
      paused: false,
      target: event.target,
    });
    if (action !== null) {
      event.preventDefault();
    }
  };
  window.addEventListener("keydown", onKeyDown);

  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code,
    key: code,
  });
  target.dispatchEvent(event);
  window.removeEventListener("keydown", onKeyDown);

  return { action, defaultPrevented: event.defaultPrevented };
}

describe("weapon selector focus handoff", () => {
  it("returns aiming arrows to the game while focus stays on the trigger", () => {
    const trigger = document.createElement("button");
    trigger.dataset.gameKeyboardOwner = "aiming";
    document.body.append(trigger);
    trigger.focus();

    const result = dispatchAimingKey(trigger, "ArrowRight");

    expect(document.activeElement).toBe(trigger);
    expect(result).toEqual({
      action: { type: "adjust-angle", screenDirection: 1 },
      defaultPrevented: true,
    });
  });

  it("keeps selector buttons and editable controls in native control", () => {
    const selectorOption = document.createElement("button");
    const range = document.createElement("input");
    range.type = "range";
    document.body.append(selectorOption, range);

    selectorOption.focus();
    expect(dispatchAimingKey(selectorOption, "ArrowLeft")).toEqual({
      action: null,
      defaultPrevented: false,
    });

    range.focus();
    expect(dispatchAimingKey(range, "ArrowUp")).toEqual({
      action: null,
      defaultPrevented: false,
    });
    expect(document.activeElement).toBe(range);
  });
});
