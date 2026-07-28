export type SelectorCloseOutcome = "committed" | "cancelled";

interface SelectorFocusTargets {
  readonly gameplayOwner: HTMLElement | null;
  readonly trigger: HTMLElement | null;
}

type FocusScheduler = (callback: FrameRequestCallback) => number;

export function scheduleSelectorFocus(
  outcome: SelectorCloseOutcome,
  targets: SelectorFocusTargets,
  schedule: FocusScheduler = requestAnimationFrame,
): number {
  return schedule(() => {
    const target =
      outcome === "committed" ? targets.gameplayOwner : targets.trigger;
    target?.focus({ preventScroll: true });
  });
}
