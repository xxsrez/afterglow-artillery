import {
  canSelectWeapon,
  shouldConsumeAmmo,
  type DemoMatchMode,
} from "./match-policy";
import type { PlayerTurnState } from "./types";
import type { WeaponId } from "./weapons";

export const BASELINE_WEAPON_ID: WeaponId = "babyMissile";

export function isPlayerWeaponAvailable(
  player: Readonly<PlayerTurnState>,
  weaponId: WeaponId,
  mode: DemoMatchMode,
): boolean {
  return canSelectWeapon(mode, player, weaponId);
}

export function availableSelectedWeapon(
  player: Readonly<PlayerTurnState>,
  mode: DemoMatchMode,
): WeaponId {
  return isPlayerWeaponAvailable(player, player.selectedWeapon, mode)
    ? player.selectedWeapon
    : BASELINE_WEAPON_ID;
}

export function restoreAvailableSelectedWeapon(
  player: PlayerTurnState,
  mode: DemoMatchMode,
): WeaponId {
  const weaponId = availableSelectedWeapon(player, mode);
  player.selectedWeapon = weaponId;
  return weaponId;
}

export function selectPlayerWeapon(
  player: PlayerTurnState,
  weaponId: WeaponId,
  mode: DemoMatchMode,
): boolean {
  if (!isPlayerWeaponAvailable(player, weaponId, mode)) {
    return false;
  }
  player.selectedWeapon = weaponId;
  return true;
}

export function consumePlayerWeapon(
  player: PlayerTurnState,
  weaponId: WeaponId,
  mode: DemoMatchMode,
): number {
  if (!shouldConsumeAmmo(mode, weaponId)) {
    return player.inventory[weaponId] ?? 0;
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
