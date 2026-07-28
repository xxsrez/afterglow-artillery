import { describe, expect, it } from "vitest";

import {
  WEAPON_SELECTOR_FILTERS,
  isWeaponSelectorCloseKey,
  isWeaponSelectable,
  nextWeaponFocus,
  weaponAmmoCount,
  weaponCatalogSubtitle,
  weaponClassicAlias,
  weaponMechanicLabel,
  weaponsForSelectorFilter,
} from "../app/game/weapon-selector";
import { getWeapon, WEAPONS, WEAPON_IDS } from "../lib/game";

describe("weapon selector", () => {
  it("keeps all 33 weapons in canonical order with the baseline first", () => {
    const weapons = weaponsForSelectorFilter("all");

    expect(weapons).toHaveLength(33);
    expect(weapons.map(({ id }) => id)).toEqual(WEAPON_IDS);
    expect(weapons[0]?.id).toBe("babyMissile");
  });

  it("groups every weapon into exactly one visible mechanical category", () => {
    const groupedIds = WEAPON_SELECTOR_FILTERS.filter(
      ({ id }) => id !== "all" && id !== "heavy" && id !== "experimental",
    ).flatMap(({ id }) =>
      weaponsForSelectorFilter(id).map(({ id: weaponId }) => weaponId),
    );

    expect(groupedIds).toHaveLength(WEAPONS.length);
    expect(new Set(groupedIds)).toEqual(new Set(WEAPON_IDS));
    expect(weaponsForSelectorFilter("experimental")).toEqual([]);
  });

  it("spotlights the six nuclear and composite heavy weapons", () => {
    expect(
      weaponsForSelectorFilter("heavy").map(({ id }) => id),
    ).toEqual([
      "babyNuke",
      "nuke",
      "leapFrog",
      "funkyBomb",
      "mirv",
      "deathsHead",
    ]);
  });

  it("keeps classic aliases discoverable without replacing public names", () => {
    expect(weaponClassicAlias(getWeapon("mirv"))).toBe("MIRV");
    expect(weaponClassicAlias(getWeapon("nuke"))).toBe("Nuke");
    expect(weaponClassicAlias(getWeapon("funkyBomb"))).toBeNull();
    expect(weaponCatalogSubtitle(getWeapon("mirv"))).toBe(
      "MIRV · Раскрытие в апогее ×5",
    );
    expect(weaponCatalogSubtitle(getWeapon("nuke"))).toBe(
      "Nuke · Большой ядерный заряд",
    );
    expect(weaponCatalogSubtitle(getWeapon("funkyBomb"))).toBe(
      "Цепь 10–14 взрывов (demo)",
    );
  });

  it("describes heavy mechanics with explicit payload roles", () => {
    expect(weaponMechanicLabel(getWeapon("babyNuke"))).toBe(
      "Малый ядерный заряд",
    );
    expect(weaponMechanicLabel(getWeapon("nuke"))).toBe(
      "Большой ядерный заряд",
    );
    expect(weaponMechanicLabel(getWeapon("leapFrog"))).toBe(
      "3 последовательных удара",
    );
    expect(weaponMechanicLabel(getWeapon("funkyBomb"))).toBe(
      "Цепь 10–14 взрывов (demo)",
    );
    expect(weaponMechanicLabel(getWeapon("mirv"))).toBe(
      "Раскрытие в апогее ×5",
    );
    expect(weaponMechanicLabel(getWeapon("deathsHead"))).toBe(
      "Тяжёлый каскад ×9",
    );
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
