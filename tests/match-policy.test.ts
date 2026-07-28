import { describe, expect, it } from "vitest";

import {
  BASELINE_WEAPON_ID,
  WEAPONS,
  canSelectWeapon,
  consumePlayerWeapon,
  selectPlayerWeapon,
  shouldConsumeAmmo,
  shouldOpenInterroundShop,
  type Inventory,
  type PlayerTurnState,
} from "../lib/game";

function makePlayer(inventory: Inventory = {}): PlayerTurnState {
  return {
    selectedWeapon: BASELINE_WEAPON_ID,
    angleDegrees: 48,
    power: 400,
    inventory: { ...inventory },
  };
}

describe("demo match ammo policy", () => {
  it("makes all 33 weapons selectable and non-consuming in Infinite Arsenal", () => {
    const finiteInventory = Object.fromEntries(
      WEAPONS.filter((weapon) => weapon.ammo.kind === "finite").map(
        (weapon) => [weapon.id, 1],
      ),
    ) as Inventory;
    const player = makePlayer(finiteInventory);

    expect(WEAPONS).toHaveLength(33);
    for (const weapon of WEAPONS) {
      expect(
        canSelectWeapon("infinite-arsenal", player, weapon.id),
      ).toBe(true);
      expect(
        shouldConsumeAmmo("infinite-arsenal", weapon.id),
      ).toBe(false);

      const before = player.inventory[weapon.id];
      consumePlayerWeapon(player, weapon.id, "infinite-arsenal");
      consumePlayerWeapon(player, weapon.id, "infinite-arsenal");
      expect(player.inventory[weapon.id]).toBe(before);
    }
  });

  it("keeps Quick Demo finite inventory and depletion unchanged", () => {
    const player = makePlayer({ missile: 1 });

    expect(canSelectWeapon("quick-demo", player, "missile")).toBe(true);
    expect(shouldConsumeAmmo("quick-demo", "missile")).toBe(true);
    expect(consumePlayerWeapon(player, "missile", "quick-demo")).toBe(0);
    expect(canSelectWeapon("quick-demo", player, "missile")).toBe(false);
    expect(
      canSelectWeapon("quick-demo", player, BASELINE_WEAPON_ID),
    ).toBe(true);
    expect(
      shouldConsumeAmmo("quick-demo", BASELINE_WEAPON_ID),
    ).toBe(false);
  });

  it("keeps showcase selections player-owned and skips the shop", () => {
    const first = makePlayer();
    const second = makePlayer();

    expect(
      selectPlayerWeapon(first, "missile", "infinite-arsenal"),
    ).toBe(true);
    expect(
      selectPlayerWeapon(second, "nuke", "infinite-arsenal"),
    ).toBe(true);
    expect(first.selectedWeapon).toBe("missile");
    expect(second.selectedWeapon).toBe("nuke");
    expect(shouldOpenInterroundShop("infinite-arsenal")).toBe(false);
    expect(shouldOpenInterroundShop("quick-demo")).toBe(true);
  });
});
