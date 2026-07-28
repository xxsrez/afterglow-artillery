import { describe, expect, it } from "vitest";

import {
  WEAPON_SELECTOR_FILTERS,
  isWeaponSelectorCloseKey,
  isWeaponSelectable,
  nextWeaponFocus,
  weaponAmmoCount,
  weaponsForSelectorFilter,
} from "../app/game/weapon-selector";
import { WEAPONS, WEAPON_IDS } from "../lib/game";

describe("weapon selector", () => {
  it("keeps all 33 weapons in canonical order with the baseline first", () => {
    const weapons = weaponsForSelectorFilter("all");

    expect(weapons).toHaveLength(33);
    expect(weapons.map(({ id }) => id)).toEqual(WEAPON_IDS);
    expect(weapons[0]?.id).toBe("babyMissile");
  });

  it("groups every weapon into exactly one visible mechanical category", () => {
    const groupedIds = WEAPON_SELECTOR_FILTERS.filter(
      ({ id }) => id !== "all",
    ).flatMap(({ id }) =>
      weaponsForSelectorFilter(id).map(({ id: weaponId }) => weaponId),
    );

    expect(groupedIds).toHaveLength(WEAPONS.length);
    expect(new Set(groupedIds)).toEqual(new Set(WEAPON_IDS));
  });

  it("keeps depleted weapons visible but not selectable", () => {
    const inventory = { missile: 0, nuke: 1 };

    expect(weaponAmmoCount(inventory, "missile")).toBe(0);
    expect(isWeaponSelectable(inventory, "missile")).toBe(false);
    expect(isWeaponSelectable(inventory, "nuke")).toBe(true);
    expect(weaponAmmoCount(inventory, "babyMissile")).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(isWeaponSelectable(inventory, "babyMissile")).toBe(true);
    expect(
      weaponsForSelectorFilter("all").some(({ id }) => id === "missile"),
    ).toBe(true);
  });

  it("moves focus predictably with arrows and Home/End", () => {
    const ids = ["babyMissile", "missile", "nuke"] as const;

    expect(nextWeaponFocus(ids, "missile", "ArrowLeft")).toBe("babyMissile");
    expect(nextWeaponFocus(ids, "missile", "ArrowDown")).toBe("nuke");
    expect(nextWeaponFocus(ids, "babyMissile", "ArrowUp")).toBe(
      "babyMissile",
    );
    expect(nextWeaponFocus(ids, "nuke", "ArrowRight")).toBe("nuke");
    expect(nextWeaponFocus(ids, "missile", "Home")).toBe("babyMissile");
    expect(nextWeaponFocus(ids, "missile", "End")).toBe("nuke");
    expect(nextWeaponFocus(ids, "missile", "Escape")).toBeNull();
  });

  it("recognizes Escape as the explicit close command", () => {
    expect(isWeaponSelectorCloseKey("Escape")).toBe(true);
    expect(isWeaponSelectorCloseKey("Enter")).toBe(false);
    expect(isWeaponSelectorCloseKey("ArrowLeft")).toBe(false);
  });
});
