export const WEAPON_IDS = [
  "shell",
  "mirv",
  "roller",
  "digger",
  "napalm",
  "dirtBloom",
] as const;

export type WeaponId = (typeof WEAPON_IDS)[number];

export type WeaponRole =
  | "reliable-blast"
  | "cluster-pressure"
  | "terrain-seeking"
  | "terrain-penetration"
  | "surface-control"
  | "terrain-creation";

export type WeaponDelivery =
  | "ballistic"
  | "cluster"
  | "rolling"
  | "subterranean"
  | "liquid";

export type WeaponTerrainEffect = "carve" | "scorch" | "fill";

export type WeaponAmmo =
  | {
      readonly kind: "unlimited";
    }
  | {
      readonly kind: "finite";
      readonly bundleSize: number;
    };

export interface WeaponDefinition {
  readonly id: WeaponId;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  /** Price of one bundle in the between-round shop. */
  readonly price: number;
  readonly ammo: WeaponAmmo;
  readonly role: WeaponRole;
  readonly delivery: WeaponDelivery;
  readonly terrainEffect: WeaponTerrainEffect;
  readonly blastRadius: number | null;
  readonly accent: string;
}

/**
 * Vertical-slice catalog. Prices and finite bundle sizes preserve the
 * corresponding documented 1.5 relationships; names and presentation are
 * original to this project. The baseline shell is always available.
 */
export const WEAPONS = Object.freeze([
  Object.freeze({
    id: "shell",
    name: "Star Shell",
    shortName: "Shell",
    description: "A clean, dependable blast for learning angle and wind.",
    price: 0,
    ammo: Object.freeze({ kind: "unlimited" }),
    role: "reliable-blast",
    delivery: "ballistic",
    terrainEffect: "carve",
    blastRadius: 10,
    accent: "#ffe083",
  }),
  Object.freeze({
    id: "mirv",
    name: "Prism MIRV",
    shortName: "MIRV",
    description: "Splits near the apex into a fan of readable child shots.",
    price: 10_000,
    ammo: Object.freeze({ kind: "finite", bundleSize: 3 }),
    role: "cluster-pressure",
    delivery: "cluster",
    terrainEffect: "carve",
    blastRadius: 20,
    accent: "#d38cff",
  }),
  Object.freeze({
    id: "roller",
    name: "Comet Roller",
    shortName: "Roller",
    description: "Lands, follows the slope, then detonates in a low point.",
    price: 6_000,
    ammo: Object.freeze({ kind: "finite", bundleSize: 5 }),
    role: "terrain-seeking",
    delivery: "rolling",
    terrainEffect: "carve",
    blastRadius: 20,
    accent: "#7bf4ff",
  }),
  Object.freeze({
    id: "digger",
    name: "Deep Bore",
    shortName: "Digger",
    description: "Keeps travelling underground to attack protected ground.",
    price: 2_500,
    ammo: Object.freeze({ kind: "finite", bundleSize: 5 }),
    role: "terrain-penetration",
    delivery: "subterranean",
    terrainEffect: "carve",
    blastRadius: null,
    accent: "#ff9d57",
  }),
  Object.freeze({
    id: "napalm",
    name: "Solar Gel",
    shortName: "Napalm",
    description: "Spreads luminous heat across the surface and into hollows.",
    price: 10_000,
    ammo: Object.freeze({ kind: "finite", bundleSize: 10 }),
    role: "surface-control",
    delivery: "liquid",
    terrainEffect: "scorch",
    blastRadius: null,
    accent: "#ff5f45",
  }),
  Object.freeze({
    id: "dirtBloom",
    name: "Dirt Bloom",
    shortName: "Bloom",
    description: "Grows a solid shelter that permanently reshapes the shot.",
    price: 5_000,
    ammo: Object.freeze({ kind: "finite", bundleSize: 5 }),
    role: "terrain-creation",
    delivery: "ballistic",
    terrainEffect: "fill",
    blastRadius: 35,
    accent: "#7ee081",
  }),
] as const satisfies readonly WeaponDefinition[]);

export const WEAPON_BY_ID: Readonly<Record<WeaponId, WeaponDefinition>> =
  Object.freeze(
    Object.fromEntries(WEAPONS.map((weapon) => [weapon.id, weapon])) as Record<
      WeaponId,
      WeaponDefinition
    >,
  );

export function isWeaponId(value: string): value is WeaponId {
  return (WEAPON_IDS as readonly string[]).includes(value);
}

export function getWeapon(id: WeaponId): WeaponDefinition {
  return WEAPON_BY_ID[id];
}
