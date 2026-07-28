import type { PlayerTurnState } from "./types";
import { getWeapon, type WeaponId } from "./weapons";

export const BASELINE_WEAPON_ID: WeaponId = "babyMissile";

export function isPlayerWeaponAvailable(
  player: Readonly<PlayerTurnState>,
  weaponId: WeaponId,
): boolean {
  return (
    getWeapon(weaponId).ammo.kind === "unlimited" ||
    (player.inventory[weaponId] ?? 0) > 0
  );
}

export function availableSelectedWeapon(
  player: Readonly<PlayerTurnState>,
): WeaponId {
  return isPlayerWeaponAvailable(player, player.selectedWeapon)
    ? player.selectedWeapon
    : BASELINE_WEAPON_ID;
}

export function restoreAvailableSelectedWeapon(
  player: PlayerTurnState,
): WeaponId {
  const weaponId = availableSelectedWeapon(player);
  player.selectedWeapon = weaponId;
  return weaponId;
}

export function selectPlayerWeapon(
  player: PlayerTurnState,
  weaponId: WeaponId,
): boolean {
  if (!isPlayerWeaponAvailable(player, weaponId)) {
    return false;
  }
  player.selectedWeapon = weaponId;
  return true;
}

export function consumePlayerWeapon(
  player: PlayerTurnState,
  weaponId: WeaponId,
): number {
  if (getWeapon(weaponId).ammo.kind === "unlimited") {
    return Number.POSITIVE_INFINITY;
  }

  const remaining = Math.max(0, (player.inventory[weaponId] ?? 0) - 1);
  player.inventory[weaponId] = remaining;
  return remaining;
}

export function updatePlayerAim(
  player: PlayerTurnState,
  values: {
    readonly angleDegrees?: number;
    readonly power?: number;
  },
): void {
  if (values.angleDegrees !== undefined) {
    player.angleDegrees = values.angleDegrees;
  }
  if (values.power !== undefined) {
    player.power = values.power;
  }
}

export function nextPlayerIndex(player: 0 | 1): 0 | 1 {
  return player === 0 ? 1 : 0;
}
