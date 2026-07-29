// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
  getGameKeyboardAction,
  type GameKeyboardAction,
} from "../app/game/keyboard-controls";
import {
  scheduleSelectorFocus,
  type SelectorCloseOutcome,
} from "../app/game/selector-focus";

afterEach(() => {
  document.body.replaceChildren();
});

function dispatchAimingKey(
  target: HTMLElement,
  code: string,
  phase = "aiming",
): {
  action: GameKeyboardAction | null;
  defaultPrevented: boolean;
} {
  let action: GameKeyboardAction | null = null;
  const onKeyDown = (event: KeyboardEvent) => {
    action = getGameKeyboardAction(event.code, {
      phase,
      settingsOpen: false,
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

function focusImmediately(
  outcome: SelectorCloseOutcome,
  gameplayOwner: HTMLElement,
  trigger: HTMLElement,
): void {
  scheduleSelectorFocus(
    outcome,
    { gameplayOwner, trigger },
    (callback) => {
      callback(0);
      return 1;
    },
  );
}

describe("weapon selector focus handoff", () => {
  it("hands a committed selection to gameplay so Space fires exactly once", () => {
    const gameplayOwner = document.createElement("canvas");
    gameplayOwner.tabIndex = -1;
    gameplayOwner.dataset.gameKeyboardOwner = "aiming";
    const trigger = document.createElement("button");
    trigger.dataset.gameKeyboardOwner = "aiming";
    const dialog = document.createElement("dialog");
    const option = document.createElement("button");
    dialog.append(option);
    document.body.append(gameplayOwner, trigger, dialog);

    let triggerClicks = 0;
    let optionClicks = 0;
    let fireCount = 0;
    let phase = "aiming";
    trigger.addEventListener("click", () => {
      triggerClicks += 1;
      dialog.setAttribute("open", "");
      option.focus();
    });
    option.addEventListener("click", () => {
      optionClicks += 1;
      dialog.removeAttribute("open");
      trigger.focus();
      focusImmediately("committed", gameplayOwner, trigger);
    });
    const onKeyDown = (event: KeyboardEvent) => {
      const action = getGameKeyboardAction(event.code, {
        phase,
        settingsOpen: false,
        target: event.target,
      });
      if (action?.type === "fire") {
        event.preventDefault();
        fireCount += 1;
        phase = "firing";
      }
    };
    window.addEventListener("keydown", onKeyDown);

    trigger.focus();
    trigger.click();
    option.click();

    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(gameplayOwner);
    expect(gameplayOwner.dataset.gameKeyboardOwner).toBe("aiming");

    const space = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Space",
      key: " ",
    });
    gameplayOwner.dispatchEvent(space);
    gameplayOwner.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Space",
        key: " ",
      }),
    );
    window.removeEventListener("keydown", onKeyDown);

    expect(space.defaultPrevented).toBe(true);
    expect(fireCount).toBe(1);
    expect(phase).toBe("firing");
    expect(triggerClicks).toBe(1);
    expect(optionClicks).toBe(1);
    expect(dialog.open).toBe(false);
  });

  it("hands keyboard selection to gameplay after Enter", () => {
    const gameplayOwner = document.createElement("canvas");
    gameplayOwner.tabIndex = -1;
    const trigger = document.createElement("button");
    const option = document.createElement("button");
    document.body.append(gameplayOwner, trigger, option);

    option.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      focusImmediately("committed", gameplayOwner, trigger);
    });

    option.focus();
    option.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        code: "Enter",
        key: "Enter",
      }),
    );

    expect(document.activeElement).toBe(gameplayOwner);
    expect(dispatchAimingKey(gameplayOwner, "Space")).toEqual({
      action: { type: "fire" },
      defaultPrevented: true,
    });
  });

  it("returns cancelled selectors to native trigger semantics", () => {
    const gameplayOwner = document.createElement("canvas");
    gameplayOwner.tabIndex = -1;
    const trigger = document.createElement("button");
    trigger.dataset.gameKeyboardOwner = "aiming";
    const option = document.createElement("button");
    document.body.append(gameplayOwner, trigger, option);

    option.focus();
    focusImmediately("cancelled", gameplayOwner, trigger);

    expect(document.activeElement).toBe(trigger);
    expect(dispatchAimingKey(trigger, "Space")).toEqual({
      action: null,
      defaultPrevented: false,
    });
    expect(dispatchAimingKey(trigger, "Enter")).toEqual({
      action: null,
      defaultPrevented: false,
    });
    expect(dispatchAimingKey(trigger, "ArrowRight")).toEqual({
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
