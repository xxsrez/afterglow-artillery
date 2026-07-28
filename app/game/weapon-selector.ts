import {
  WEAPONS,
  getWeapon,
  type Inventory,
  type WeaponCategory,
  type WeaponDefinition,
  type WeaponFamily,
  type WeaponId,
} from "../../lib/game";

export type WeaponSelectorFilterId =
  | "all"
  | "heavy"
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
  readonly families?: readonly WeaponFamily[];
}

export const WEAPON_SELECTOR_FILTERS: readonly WeaponSelectorFilter[] = [
  { id: "all", label: "Все 33", categories: null },
  {
    id: "heavy",
    label: "Тяжёлое",
    categories: null,
    families: ["nuclear", "cluster"],
  },
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

/**
 * Коротко объясняет механику публичными названиями проекта. Classic catalog
 * labels намеренно не используются: это presentation copy, а не справочник.
 */
export function weaponMechanicLabel(weapon: WeaponDefinition): string {
  switch (weapon.id) {
    case "babyNuke":
      return "Малый ядерный заряд";
    case "nuke":
      return "Большой ядерный заряд";
    case "leapFrog":
      return "3 последовательных удара";
    case "funkyBomb":
      return "Цепь 10–14 взрывов (demo)";
    case "mirv":
      return "Раскрытие в апогее ×5";
    case "deathsHead":
      return "Тяжёлый каскад ×9";
  }

  const countSuffix =
    weapon.demoResolution.count > 1
      ? ` ×${weapon.demoResolution.count}`
      : "";

  switch (weapon.delivery) {
    case "ballistic-sequence":
      return `Последовательные удары${countSuffix}`;
    case "airburst-cluster":
      return `Воздушный каскад${countSuffix}`;
    case "rolling":
      return "Катящийся заряд";
    case "subterranean":
      return "Подземный удар";
    case "subterranean-cluster":
      return `Подземный каскад${countSuffix}`;
    case "liquid":
      return weapon.effectKind === "surface-fire"
        ? `Огненный поток${countSuffix}`
        : `Текучий грунт${countSuffix}`;
    case "tank-mounted":
      return weapon.effectKind === "terrain-fill"
        ? "Грунт перед танком"
        : "Расчистка перед танком";
    case "radial":
      return weapon.effectKind === "energy-blast"
        ? "Энергетический импульс"
        : "Осаждение грунта";
    case "beam":
      return "Прямой энергетический луч";
    case "ballistic":
      switch (weapon.effectKind) {
        case "trace":
          return "Безвредная пристрелка";
        case "terrain-carve":
          return "Разрушение грунта";
        case "terrain-fill":
          return "Создание грунта";
        default:
          return "Одиночный взрыв";
      }
  }
}

export function weaponsForSelectorFilter(
  filterId: WeaponSelectorFilterId,
  weapons: readonly WeaponDefinition[] = WEAPONS,
): readonly WeaponDefinition[] {
  const filter =
    WEAPON_SELECTOR_FILTERS.find((candidate) => candidate.id === filterId) ??
    WEAPON_SELECTOR_FILTERS[0];

  if (filter.families !== undefined) {
    return weapons.filter((weapon) => filter.families?.includes(weapon.family));
  }

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
