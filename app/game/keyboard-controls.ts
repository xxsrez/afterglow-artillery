export type GameKeyboardAction =
  | { readonly type: "adjust-angle"; readonly delta: -1 | 1 }
  | { readonly type: "adjust-power"; readonly delta: -10 | 10 }
  | { readonly type: "cycle-weapon"; readonly direction: -1 | 1 }
  | { readonly type: "fire" }
  | { readonly type: "toggle-pause" };

interface KeyboardControlContext {
  readonly phase: string;
  readonly paused: boolean;
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

export function isKeyboardControlTarget(target: EventTarget | null): boolean {
  const tagName = targetTagName(target);
  return tagName === "INPUT" || tagName === "BUTTON" || tagName === "SELECT";
}

export function getGameKeyboardAction(
  code: string,
  context: KeyboardControlContext,
): GameKeyboardAction | null {
  if (isKeyboardControlTarget(context.target)) {
    return null;
  }

  if (code === "Escape" || code === "KeyP") {
    return context.phase === "aiming" ||
      context.phase === "firing" ||
      context.paused
      ? { type: "toggle-pause" }
      : null;
  }

  if (context.phase !== "aiming" || context.paused) {
    return null;
  }

  switch (code) {
    case "ArrowLeft":
      return { type: "adjust-angle", delta: -1 };
    case "ArrowRight":
      return { type: "adjust-angle", delta: 1 };
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
