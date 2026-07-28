import type { PlayerTurnState } from "./types";
import { getWeapon, type WeaponId } from "./weapons";

export type DemoMatchMode = "quick-demo" | "infinite-arsenal";

export const DEFAULT_DEMO_MATCH_MODE: DemoMatchMode = "quick-demo";

export function isInfiniteArsenalMode(
  mode: DemoMatchMode,
): boolean {
  return mode === "infinite-arsenal";
}

export function shouldConsumeAmmo(
  mode: DemoMatchMode,
  weaponId: WeaponId,
): boolean {
  return (
    !isInfiniteArsenalMode(mode) &&
    getWeapon(weaponId).ammo.kind === "finite"
  );
}

export function canSelectWeapon(
  mode: DemoMatchMode,
  player: Readonly<PlayerTurnState>,
  weaponId: WeaponId,
): boolean {
  return (
    !shouldConsumeAmmo(mode, weaponId) ||
    (player.inventory[weaponId] ?? 0) > 0
  );
}

export function shouldOpenInterroundShop(
  mode: DemoMatchMode,
): boolean {
  return !isInfiniteArsenalMode(mode);
}
