export type GameKeyboardAction =
  | {
      readonly type: "adjust-angle";
      readonly screenDirection: -1 | 1;
    }
  | { readonly type: "adjust-power"; readonly delta: -10 | 10 }
  | { readonly type: "cycle-weapon"; readonly direction: -1 | 1 }
  | { readonly type: "fire" }
  | { readonly type: "toggle-settings" };

interface KeyboardControlContext {
  readonly phase: string;
  readonly settingsOpen: boolean;
  readonly target: EventTarget | null;
}

function targetTagName(target: EventTarget | null): string | null {
  if (
    target === null ||
    typeof target !== "object" ||
    !("tagName" in target) ||
    typeof target.tagName !== "string"
  ) {
    return null;
  }

  return target.tagName.toUpperCase();
}

function targetAttribute(
  target: EventTarget | null,
  name: string,
): string | null {
  if (
    target === null ||
    typeof target !== "object" ||
    !("getAttribute" in target) ||
    typeof target.getAttribute !== "function"
  ) {
    return null;
  }

  return target.getAttribute(name);
}

export function isKeyboardControlTarget(target: EventTarget | null): boolean {
  const tagName = targetTagName(target);
  const contentEditable =
    target !== null &&
    typeof target === "object" &&
    "isContentEditable" in target &&
    target.isContentEditable === true;

  return (
    contentEditable ||
    tagName === "A" ||
    tagName === "BUTTON" ||
    tagName === "INPUT" ||
    tagName === "SELECT" ||
    tagName === "TEXTAREA"
  );
}

export function isAimingKeyboardOwner(
  target: EventTarget | null,
): boolean {
  return (
    targetTagName(target) === "BUTTON" &&
    targetAttribute(target, "data-game-keyboard-owner") === "aiming"
  );
}

function isAimingArrow(code: string): boolean {
  return (
    code === "ArrowLeft" ||
    code === "ArrowRight" ||
    code === "ArrowUp" ||
    code === "ArrowDown"
  );
}

export function angleDeltaForScreenDirection(
  screenDirection: -1 | 1,
  tankDirection: -1 | 1,
): -1 | 1 {
  return (-screenDirection * tankDirection) as -1 | 1;
}

export function barrelEndX(
  originX: number,
  angleDegrees: number,
  tankDirection: -1 | 1,
  length: number,
): number {
  const radians = (angleDegrees * Math.PI) / 180;
  return originX + Math.cos(radians) * tankDirection * length;
}

export function getGameKeyboardAction(
  code: string,
  context: KeyboardControlContext,
): GameKeyboardAction | null {
  if (
    isKeyboardControlTarget(context.target) &&
    !(isAimingKeyboardOwner(context.target) && isAimingArrow(code))
  ) {
    return null;
  }

  if (code === "Escape" || code === "KeyP") {
    return context.phase === "aiming" || context.settingsOpen
      ? { type: "toggle-settings" }
      : null;
  }

  if (context.phase !== "aiming" || context.settingsOpen) {
    return null;
  }

  switch (code) {
    case "ArrowLeft":
      return { type: "adjust-angle", screenDirection: -1 };
    case "ArrowRight":
      return { type: "adjust-angle", screenDirection: 1 };
    case "ArrowUp":
      return { type: "adjust-power", delta: 10 };
    case "ArrowDown":
      return { type: "adjust-power", delta: -10 };
    case "KeyQ":
      return { type: "cycle-weapon", direction: -1 };
    case "KeyE":
      return { type: "cycle-weapon", direction: 1 };
    case "Space":
    case "Enter":
      return { type: "fire" };
    default:
      return null;
  }
}
