import type { ShieldId } from "../../lib/game";

export function isShieldSelectorCloseKey(key: string): boolean {
  return key === "Escape";
}

export function nextShieldFocus(
  shieldIds: readonly ShieldId[],
  currentId: ShieldId,
  key: string,
): ShieldId | null {
  if (shieldIds.length === 0) {
    return null;
  }

  if (key === "Home") {
    return shieldIds[0] ?? null;
  }
  if (key === "End") {
    return shieldIds.at(-1) ?? null;
  }

  const direction =
    key === "ArrowLeft" || key === "ArrowUp"
      ? -1
      : key === "ArrowRight" || key === "ArrowDown"
        ? 1
        : 0;
  if (direction === 0) {
    return null;
  }

  const currentIndex = shieldIds.indexOf(currentId);
  if (currentIndex < 0) {
    return shieldIds[0] ?? null;
  }

  const nextIndex = Math.max(
    0,
    Math.min(shieldIds.length - 1, currentIndex + direction),
  );
  return shieldIds[nextIndex] ?? null;
}
