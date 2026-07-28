import {
  WEAPONS,
  getWeapon,
  type Inventory,
  type WeaponCategory,
  type WeaponDefinition,
  type WeaponId,
} from "../../lib/game";

export type WeaponSelectorFilterId =
  | "all"
  | "strike"
  | "terrain-destruction"
  | "terrain-creation"
  | "utility"
  | "energy"
  | "experimental";

interface WeaponSelectorFilter {
  readonly id: WeaponSelectorFilterId;
  readonly label: string;
  readonly categories: readonly WeaponCategory[] | null;
}

export const WEAPON_SELECTOR_FILTERS: readonly WeaponSelectorFilter[] = [
  { id: "all", label: "Все 33", categories: null },
  {
    id: "strike",
    label: "Удар",
    categories: ["ordnance", "incendiary"],
  },
  {
    id: "terrain-destruction",
    label: "Разрушить",
    categories: ["terrain-destruction"],
  },
  {
    id: "terrain-creation",
    label: "Создать грунт",
    categories: ["terrain-creation"],
  },
  { id: "utility", label: "Пристрелка", categories: ["utility"] },
  { id: "energy", label: "Энергия", categories: ["energy"] },
  { id: "experimental", label: "Experimental 10", categories: [] },
] as const;

const CATEGORY_LABELS: Record<WeaponCategory, string> = {
  ordnance: "Удар",
  incendiary: "Поток",
  utility: "Пристрелка",
  "terrain-destruction": "Разрушение",
  "terrain-creation": "Создание грунта",
  energy: "Энергия",
};

export function weaponCategoryLabel(category: WeaponCategory): string {
  return CATEGORY_LABELS[category];
}

export function weaponsForSelectorFilter(
  filterId: WeaponSelectorFilterId,
  weapons: readonly WeaponDefinition[] = WEAPONS,
): readonly WeaponDefinition[] {
  const filter =
    WEAPON_SELECTOR_FILTERS.find((candidate) => candidate.id === filterId) ??
    WEAPON_SELECTOR_FILTERS[0];

  if (filter.categories === null) {
    return weapons;
  }

  return weapons.filter((weapon) => filter.categories?.includes(weapon.category));
}

export function weaponAmmoCount(
  inventory: Readonly<Inventory>,
  weaponId: WeaponId,
): number {
  return getWeapon(weaponId).ammo.kind === "unlimited"
    ? Number.POSITIVE_INFINITY
    : (inventory[weaponId] ?? 0);
}

export function isWeaponSelectable(
  inventory: Readonly<Inventory>,
  weaponId: WeaponId,
): boolean {
  return (
    getWeapon(weaponId).ammo.kind === "unlimited" ||
    weaponAmmoCount(inventory, weaponId) > 0
  );
}

export function isWeaponSelectorCloseKey(key: string): boolean {
  return key === "Escape";
}

export function nextWeaponFocus<Id extends string>(
  weaponIds: readonly Id[],
  currentId: Id,
  key: string,
): Id | null {
  if (weaponIds.length === 0) {
    return null;
  }

  if (key === "Home") {
    return weaponIds[0] ?? null;
  }
  if (key === "End") {
    return weaponIds.at(-1) ?? null;
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

  const currentIndex = weaponIds.indexOf(currentId);
  if (currentIndex < 0) {
    return weaponIds[0] ?? null;
  }

  const nextIndex = Math.max(
    0,
    Math.min(weaponIds.length - 1, currentIndex + direction),
  );
  return weaponIds[nextIndex] ?? null;
}
