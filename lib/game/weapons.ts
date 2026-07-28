export const WEAPON_IDS = [
  "babyMissile",
  "missile",
  "babyNuke",
  "nuke",
  "leapFrog",
  "funkyBomb",
  "mirv",
  "deathsHead",
  "napalm",
  "hotNapalm",
  "tracer",
  "smokeTracer",
  "babyRoller",
  "roller",
  "heavyRoller",
  "riotCharge",
  "riotBlast",
  "riotBomb",
  "heavyRiotBomb",
  "babyDigger",
  "digger",
  "heavyDigger",
  "babySandhog",
  "sandhog",
  "heavySandhog",
  "dirtClod",
  "dirtBall",
  "tonOfDirt",
  "liquidDirt",
  "dirtCharge",
  "earthDisrupter",
  "plasmaBlast",
  "laser",
] as const;

export type WeaponId = (typeof WEAPON_IDS)[number];

export type WeaponFamily =
  | "missile"
  | "nuclear"
  | "cluster"
  | "napalm"
  | "tracer"
  | "roller"
  | "riot"
  | "digger"
  | "sandhog"
  | "dirt"
  | "earth-disrupter"
  | "energy";

export type WeaponCategory =
  | "ordnance"
  | "incendiary"
  | "utility"
  | "terrain-destruction"
  | "terrain-creation"
  | "energy";

export type WeaponDelivery =
  | "ballistic"
  | "ballistic-sequence"
  | "airburst-cluster"
  | "liquid"
  | "rolling"
  | "tank-mounted"
  | "subterranean"
  | "subterranean-cluster"
  | "radial"
  | "beam";

export type WeaponEffectKind =
  | "blast"
  | "cluster-blast"
  | "surface-fire"
  | "trace"
  | "terrain-carve"
  | "terrain-fill"
  | "terrain-settle"
  | "energy-blast"
  | "beam";

export type WeaponTerrainEffect =
  | "none"
  | "carve"
  | "scorch"
  | "fill"
  | "settle";

export type WeaponAmmo =
  | {
      readonly kind: "unlimited";
    }
  | {
      readonly kind: "finite";
      readonly bundleSize: number;
    };

export interface BlastRadiusRange {
  readonly min: number;
  readonly max: number;
}

/**
 * Exact blast-radius notation from the 1.5 manual:
 * - a number is one fixed radius;
 * - the tuple is Leap Frog's three successive radii;
 * - the range is Plasma Blast's battery-dependent radius;
 * - null represents the manual's N/A.
 */
export type CanonicalBlastRadius =
  | number
  | readonly [number, number, number]
  | BlastRadiusRange
  | null;

/**
 * Non-canonical tuning used by the current browser demo to resolve and present
 * all catalog entries. The 1.5 manual does not provide damage formulas, and it
 * omits effect counts and visual scale for most weapons. Radius mirrors the
 * canonical fixed/max radius where possible; otherwise every value here is a
 * provisional demo parameter, not a claim about original balance.
 */
export interface DemoResolutionParameters {
  readonly radius: number;
  readonly damage: number;
  readonly count: number;
  readonly scale: number;
}

export interface WeaponDefinition {
  readonly id: WeaponId;
  /** Original public-facing English label for this project. */
  readonly name: string;
  /** Exact classic catalog label, retained only as source-backed rules data. */
  readonly classicName: string;
  readonly shortName: string;
  /** Original, concise Russian presentation copy for this project. */
  readonly description: string;
  readonly icon: string;
  readonly family: WeaponFamily;
  readonly category: WeaponCategory;
  readonly delivery: WeaponDelivery;
  readonly effectKind: WeaponEffectKind;
  readonly terrainEffect: WeaponTerrainEffect;
  /**
   * Play price. Baby Missile is deliberately 0 because it is always available;
   * all finite weapons use their exact canonical catalog price.
   */
  readonly price: number;
  /** Exact listed bundle price from the 1.5 manual. */
  readonly catalogPrice: number;
  /** Exact listed bundle size from the 1.5 manual. */
  readonly catalogBundleSize: number;
  readonly ammo: WeaponAmmo;
  /** Exact radius notation from the 1.5 manual. */
  readonly blastRadius: CanonicalBlastRadius;
  /** Exact Arms Level from the 1.5 manual. */
  readonly armsLevel: 0 | 1 | 2 | 3 | 4;
  readonly accent: string;
  readonly secondaryAccent: string;
  readonly demoResolution: DemoResolutionParameters;
}

function defineWeapon(definition: WeaponDefinition): WeaponDefinition {
  return Object.freeze({
    ...definition,
    ammo: Object.freeze(definition.ammo),
    demoResolution: Object.freeze(definition.demoResolution),
  });
}

/**
 * Complete weapon-only catalog from Scorched Earth 1.5. Accessories are
 * intentionally excluded. Canonical values are isolated from provisional demo
 * resolution values so presentation work cannot silently rewrite the source
 * table.
 */
export const WEAPONS = Object.freeze([
  defineWeapon({
    id: "babyMissile",
    name: "Star Shell",
    classicName: "Baby Missile",
    shortName: "Star Shell",
    description: "Бесконечный базовый снаряд для точной пристрелки.",
    icon: "·",
    family: "missile",
    category: "ordnance",
    delivery: "ballistic",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 0,
    catalogPrice: 400,
    catalogBundleSize: 10,
    ammo: { kind: "unlimited" },
    blastRadius: 10,
    armsLevel: 0,
    accent: "#ffd166",
    secondaryAccent: "#fff3b0",
    demoResolution: { radius: 10, damage: 18, count: 1, scale: 0.72 },
  }),
  defineWeapon({
    id: "missile",
    name: "Nova Missile",
    classicName: "Missile",
    shortName: "Nova Missile",
    description: "Надёжный снаряд со средней зоной взрыва.",
    icon: "•",
    family: "missile",
    category: "ordnance",
    delivery: "ballistic",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 1_875,
    catalogPrice: 1_875,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: 20,
    armsLevel: 0,
    accent: "#ffb703",
    secondaryAccent: "#fff0a6",
    demoResolution: { radius: 20, damage: 34, count: 1, scale: 0.9 },
  }),
  defineWeapon({
    id: "babyNuke",
    name: "Nova Seed",
    classicName: "Baby Nuke",
    shortName: "Nova Seed",
    description: "Компактный ядерный заряд с широкой воронкой.",
    icon: "☢",
    family: "nuclear",
    category: "ordnance",
    delivery: "ballistic",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 10_000,
    catalogPrice: 10_000,
    catalogBundleSize: 3,
    ammo: { kind: "finite", bundleSize: 3 },
    blastRadius: 40,
    armsLevel: 0,
    accent: "#b8f34a",
    secondaryAccent: "#fff36b",
    demoResolution: { radius: 40, damage: 62, count: 1, scale: 1.2 },
  }),
  defineWeapon({
    id: "nuke",
    name: "Starbreaker",
    classicName: "Nuke",
    shortName: "Starbreaker",
    description: "Огромный одиночный взрыв для решающего удара.",
    icon: "☼",
    family: "nuclear",
    category: "ordnance",
    delivery: "ballistic",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 12_000,
    catalogPrice: 12_000,
    catalogBundleSize: 1,
    ammo: { kind: "finite", bundleSize: 1 },
    blastRadius: 75,
    armsLevel: 1,
    accent: "#eaff54",
    secondaryAccent: "#ff7b00",
    demoResolution: { radius: 75, damage: 100, count: 1, scale: 1.62 },
  }),
  defineWeapon({
    id: "leapFrog",
    name: "Triple Hop",
    classicName: "Leap Frog",
    shortName: "Triple Hop",
    description: "Три последовательных скачка с растущими взрывами.",
    icon: "↟",
    family: "cluster",
    category: "ordnance",
    delivery: "ballistic-sequence",
    effectKind: "cluster-blast",
    terrainEffect: "carve",
    price: 10_000,
    catalogPrice: 10_000,
    catalogBundleSize: 2,
    ammo: { kind: "finite", bundleSize: 2 },
    blastRadius: Object.freeze([20, 25, 30] as const),
    armsLevel: 3,
    accent: "#70e000",
    secondaryAccent: "#ccff33",
    demoResolution: { radius: 30, damage: 36, count: 3, scale: 1.08 },
  }),
  defineWeapon({
    id: "funkyBomb",
    name: "Funky Bomb",
    classicName: "Funky Bomb",
    shortName: "Funky Bomb",
    description: "Цветная непредсказуемая цепная реакция на большой площади.",
    icon: "✺",
    family: "cluster",
    category: "ordnance",
    delivery: "airburst-cluster",
    effectKind: "cluster-blast",
    terrainEffect: "carve",
    price: 7_000,
    catalogPrice: 7_000,
    catalogBundleSize: 2,
    ammo: { kind: "finite", bundleSize: 2 },
    blastRadius: 80,
    armsLevel: 4,
    accent: "#ff4ecd",
    secondaryAccent: "#65f6ff",
    demoResolution: { radius: 80, damage: 72, count: 12, scale: 1.45 },
  }),
  defineWeapon({
    id: "mirv",
    name: "Prism MIRV",
    classicName: "MIRV",
    shortName: "Prism MIRV",
    description: "В апогее раскрывается веером из пяти боеголовок.",
    icon: "⋔",
    family: "cluster",
    category: "ordnance",
    delivery: "airburst-cluster",
    effectKind: "cluster-blast",
    terrainEffect: "carve",
    price: 10_000,
    catalogPrice: 10_000,
    catalogBundleSize: 3,
    ammo: { kind: "finite", bundleSize: 3 },
    blastRadius: 20,
    armsLevel: 2,
    accent: "#c77dff",
    secondaryAccent: "#80ffdb",
    demoResolution: { radius: 20, damage: 32, count: 5, scale: 1.05 },
  }),
  defineWeapon({
    id: "deathsHead",
    name: "Death Crown",
    classicName: "Death's Head",
    shortName: "Death Crown",
    description: "Девять тяжёлых боеголовок накрывают широкую область.",
    icon: "☠",
    family: "cluster",
    category: "ordnance",
    delivery: "airburst-cluster",
    effectKind: "cluster-blast",
    terrainEffect: "carve",
    price: 20_000,
    catalogPrice: 20_000,
    catalogBundleSize: 1,
    ammo: { kind: "finite", bundleSize: 1 },
    blastRadius: 35,
    armsLevel: 4,
    accent: "#f72585",
    secondaryAccent: "#7209b7",
    demoResolution: { radius: 35, damage: 48, count: 9, scale: 1.4 },
  }),
  defineWeapon({
    id: "napalm",
    name: "Solar Gel",
    classicName: "Napalm",
    shortName: "Solar Gel",
    description: "Горящая жидкость растекается по поверхности и в низины.",
    icon: "♨",
    family: "napalm",
    category: "incendiary",
    delivery: "liquid",
    effectKind: "surface-fire",
    terrainEffect: "scorch",
    price: 10_000,
    catalogPrice: 10_000,
    catalogBundleSize: 10,
    ammo: { kind: "finite", bundleSize: 10 },
    blastRadius: null,
    armsLevel: 2,
    accent: "#ff6b35",
    secondaryAccent: "#ffd166",
    demoResolution: { radius: 28, damage: 46, count: 12, scale: 1 },
  }),
  defineWeapon({
    id: "hotNapalm",
    name: "Corona Gel",
    classicName: "Hot Napalm",
    shortName: "Corona Gel",
    description: "Более плотный и жаркий поток для глубоких впадин.",
    icon: "♨",
    family: "napalm",
    category: "incendiary",
    delivery: "liquid",
    effectKind: "surface-fire",
    terrainEffect: "scorch",
    price: 20_000,
    catalogPrice: 20_000,
    catalogBundleSize: 2,
    ammo: { kind: "finite", bundleSize: 2 },
    blastRadius: null,
    armsLevel: 4,
    accent: "#ff2d00",
    secondaryAccent: "#ffcf33",
    demoResolution: { radius: 42, damage: 78, count: 20, scale: 1.35 },
  }),
  defineWeapon({
    id: "tracer",
    name: "Light Needle",
    classicName: "Tracer",
    shortName: "Light Needle",
    description: "Безвредный пробный выстрел для поправки прицела.",
    icon: "⌁",
    family: "tracer",
    category: "utility",
    delivery: "ballistic",
    effectKind: "trace",
    terrainEffect: "none",
    price: 10,
    catalogPrice: 10,
    catalogBundleSize: 20,
    ammo: { kind: "finite", bundleSize: 20 },
    blastRadius: 0,
    armsLevel: 0,
    accent: "#bde0fe",
    secondaryAccent: "#ffffff",
    demoResolution: { radius: 0, damage: 0, count: 1, scale: 0.65 },
  }),
  defineWeapon({
    id: "smokeTracer",
    name: "Spectrum Tracer",
    classicName: "Smoke Tracer",
    shortName: "Spectrum Tracer",
    description: "Безвредная пристрелка с долгим дымным следом.",
    icon: "≈",
    family: "tracer",
    category: "utility",
    delivery: "ballistic",
    effectKind: "trace",
    terrainEffect: "none",
    price: 500,
    catalogPrice: 500,
    catalogBundleSize: 10,
    ammo: { kind: "finite", bundleSize: 10 },
    blastRadius: 0,
    armsLevel: 1,
    accent: "#adb5bd",
    secondaryAccent: "#f8f9fa",
    demoResolution: { radius: 0, damage: 0, count: 1, scale: 0.82 },
  }),
  defineWeapon({
    id: "babyRoller",
    name: "Pebble Roller",
    classicName: "Baby Roller",
    shortName: "Pebble Roller",
    description: "Малый заряд скатывается в ближайшую низину.",
    icon: "●",
    family: "roller",
    category: "ordnance",
    delivery: "rolling",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 5_000,
    catalogPrice: 5_000,
    catalogBundleSize: 10,
    ammo: { kind: "finite", bundleSize: 10 },
    blastRadius: 10,
    armsLevel: 2,
    accent: "#48cae4",
    secondaryAccent: "#caf0f8",
    demoResolution: { radius: 10, damage: 20, count: 1, scale: 0.74 },
  }),
  defineWeapon({
    id: "roller",
    name: "Comet Roller",
    classicName: "Roller",
    shortName: "Comet Roller",
    description: "Катится по склону и взрывается у цели или в низине.",
    icon: "●",
    family: "roller",
    category: "ordnance",
    delivery: "rolling",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 6_000,
    catalogPrice: 6_000,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: 20,
    armsLevel: 2,
    accent: "#00b4d8",
    secondaryAccent: "#90e0ef",
    demoResolution: { radius: 20, damage: 38, count: 1, scale: 0.96 },
  }),
  defineWeapon({
    id: "heavyRoller",
    name: "Nova Roller",
    classicName: "Heavy Roller",
    shortName: "Nova Roller",
    description: "Тяжёлый катящийся заряд с крупной финальной воронкой.",
    icon: "◉",
    family: "roller",
    category: "ordnance",
    delivery: "rolling",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 6_750,
    catalogPrice: 6_750,
    catalogBundleSize: 2,
    ammo: { kind: "finite", bundleSize: 2 },
    blastRadius: 45,
    armsLevel: 3,
    accent: "#0077b6",
    secondaryAccent: "#48cae4",
    demoResolution: { radius: 45, damage: 70, count: 1, scale: 1.25 },
  }),
  defineWeapon({
    id: "riotCharge",
    name: "Escape Charge",
    classicName: "Riot Charge",
    shortName: "Escape Charge",
    description: "Вырезает малый клин земли рядом с башней.",
    icon: "◁",
    family: "riot",
    category: "terrain-destruction",
    delivery: "tank-mounted",
    effectKind: "terrain-carve",
    terrainEffect: "carve",
    price: 2_000,
    catalogPrice: 2_000,
    catalogBundleSize: 10,
    ammo: { kind: "finite", bundleSize: 10 },
    blastRadius: 36,
    armsLevel: 2,
    accent: "#ff9f1c",
    secondaryAccent: "#ffbf69",
    demoResolution: { radius: 36, damage: 0, count: 1, scale: 0.82 },
  }),
  defineWeapon({
    id: "riotBlast",
    name: "Escape Wave",
    classicName: "Riot Blast",
    shortName: "Escape Wave",
    description: "Расчищает широкий клин, освобождая линию огня.",
    icon: "◀",
    family: "riot",
    category: "terrain-destruction",
    delivery: "tank-mounted",
    effectKind: "terrain-carve",
    terrainEffect: "carve",
    price: 5_000,
    catalogPrice: 5_000,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: 60,
    armsLevel: 3,
    accent: "#f77f00",
    secondaryAccent: "#fcbf49",
    demoResolution: { radius: 60, damage: 0, count: 1, scale: 1.18 },
  }),
  defineWeapon({
    id: "riotBomb",
    name: "Null Bomb",
    classicName: "Riot Bomb",
    shortName: "Null Bomb",
    description: "Удаляет круг материала без прямого урона танкам.",
    icon: "○",
    family: "riot",
    category: "terrain-destruction",
    delivery: "ballistic",
    effectKind: "terrain-carve",
    terrainEffect: "carve",
    price: 5_000,
    catalogPrice: 5_000,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: 30,
    armsLevel: 3,
    accent: "#f48c06",
    secondaryAccent: "#ffba08",
    demoResolution: { radius: 30, damage: 0, count: 1, scale: 0.92 },
  }),
  defineWeapon({
    id: "heavyRiotBomb",
    name: "Grand Null",
    classicName: "Heavy Riot Bomb",
    shortName: "Grand Null",
    description: "Удаляет большой круг материала без прямого урона.",
    icon: "◯",
    family: "riot",
    category: "terrain-destruction",
    delivery: "ballistic",
    effectKind: "terrain-carve",
    terrainEffect: "carve",
    price: 4_750,
    catalogPrice: 4_750,
    catalogBundleSize: 2,
    ammo: { kind: "finite", bundleSize: 2 },
    blastRadius: 45,
    armsLevel: 3,
    accent: "#dc2f02",
    secondaryAccent: "#ffba08",
    demoResolution: { radius: 45, damage: 0, count: 1, scale: 1.18 },
  }),
  defineWeapon({
    id: "babyDigger",
    name: "Mole Bit",
    classicName: "Baby Digger",
    shortName: "Mole Bit",
    description: "Малый заряд уходит под землю к защищённой цели.",
    icon: "▽",
    family: "digger",
    category: "ordnance",
    delivery: "subterranean",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 3_000,
    catalogPrice: 3_000,
    catalogBundleSize: 10,
    ammo: { kind: "finite", bundleSize: 10 },
    blastRadius: null,
    armsLevel: 0,
    accent: "#c97b36",
    secondaryAccent: "#f2cc8f",
    demoResolution: { radius: 12, damage: 26, count: 1, scale: 0.74 },
  }),
  defineWeapon({
    id: "digger",
    name: "Deep Bore",
    classicName: "Digger",
    shortName: "Deep Bore",
    description: "Проникает сквозь грунт и атакует снизу.",
    icon: "▼",
    family: "digger",
    category: "ordnance",
    delivery: "subterranean",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 2_500,
    catalogPrice: 2_500,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: null,
    armsLevel: 0,
    accent: "#a85d2a",
    secondaryAccent: "#dda15e",
    demoResolution: { radius: 20, damage: 46, count: 1, scale: 0.96 },
  }),
  defineWeapon({
    id: "heavyDigger",
    name: "Abyss Bore",
    classicName: "Heavy Digger",
    shortName: "Abyss Bore",
    description: "Мощный подземный заряд для глубокого обхода защиты.",
    icon: "◆",
    family: "digger",
    category: "ordnance",
    delivery: "subterranean",
    effectKind: "blast",
    terrainEffect: "carve",
    price: 6_750,
    catalogPrice: 6_750,
    catalogBundleSize: 2,
    ammo: { kind: "finite", bundleSize: 2 },
    blastRadius: null,
    armsLevel: 1,
    accent: "#7f4f24",
    secondaryAccent: "#e6b566",
    demoResolution: { radius: 34, damage: 72, count: 1, scale: 1.25 },
  }),
  defineWeapon({
    id: "babySandhog",
    name: "Burrow Swarm",
    classicName: "Baby Sandhog",
    shortName: "Burrow Swarm",
    description: "Малый подземный каскад обходит щит снизу.",
    icon: "⌄",
    family: "sandhog",
    category: "ordnance",
    delivery: "subterranean-cluster",
    effectKind: "cluster-blast",
    terrainEffect: "carve",
    price: 10_000,
    catalogPrice: 10_000,
    catalogBundleSize: 10,
    ammo: { kind: "finite", bundleSize: 10 },
    blastRadius: null,
    armsLevel: 0,
    accent: "#e9c46a",
    secondaryAccent: "#f4a261",
    demoResolution: { radius: 14, damage: 30, count: 3, scale: 0.82 },
  }),
  defineWeapon({
    id: "sandhog",
    name: "Tunnel Swarm",
    classicName: "Sandhog",
    shortName: "Tunnel Swarm",
    description: "Подземные боеголовки и малые заряды вскрывают укрытие.",
    icon: "≋",
    family: "sandhog",
    category: "ordnance",
    delivery: "subterranean-cluster",
    effectKind: "cluster-blast",
    terrainEffect: "carve",
    price: 16_750,
    catalogPrice: 16_750,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: null,
    armsLevel: 0,
    accent: "#d4a373",
    secondaryAccent: "#faedcd",
    demoResolution: { radius: 20, damage: 50, count: 5, scale: 1.05 },
  }),
  defineWeapon({
    id: "heavySandhog",
    name: "World Eater",
    classicName: "Heavy Sandhog",
    shortName: "World Eater",
    description: "Тяжёлый подземный каскад для укреплённых целей.",
    icon: "≣",
    family: "sandhog",
    category: "ordnance",
    delivery: "subterranean-cluster",
    effectKind: "cluster-blast",
    terrainEffect: "carve",
    price: 25_000,
    catalogPrice: 25_000,
    catalogBundleSize: 2,
    ammo: { kind: "finite", bundleSize: 2 },
    blastRadius: null,
    armsLevel: 1,
    accent: "#bc6c25",
    secondaryAccent: "#fefae0",
    demoResolution: { radius: 30, damage: 78, count: 7, scale: 1.34 },
  }),
  defineWeapon({
    id: "dirtClod",
    name: "Dirt Seed",
    classicName: "Dirt Clod",
    shortName: "Dirt Seed",
    description: "Создаёт малую сферу грунта для укрытия.",
    icon: "◇",
    family: "dirt",
    category: "terrain-creation",
    delivery: "ballistic",
    effectKind: "terrain-fill",
    terrainEffect: "fill",
    price: 5_000,
    catalogPrice: 5_000,
    catalogBundleSize: 10,
    ammo: { kind: "finite", bundleSize: 10 },
    blastRadius: 20,
    armsLevel: 0,
    accent: "#95d5b2",
    secondaryAccent: "#d8f3dc",
    demoResolution: { radius: 20, damage: 0, count: 1, scale: 0.78 },
  }),
  defineWeapon({
    id: "dirtBall",
    name: "Dirt Bloom",
    classicName: "Dirt Ball",
    shortName: "Dirt Bloom",
    description: "Выращивает среднюю сферу грунта вокруг попадания.",
    icon: "◆",
    family: "dirt",
    category: "terrain-creation",
    delivery: "ballistic",
    effectKind: "terrain-fill",
    terrainEffect: "fill",
    price: 5_000,
    catalogPrice: 5_000,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: 35,
    armsLevel: 0,
    accent: "#74c69d",
    secondaryAccent: "#b7e4c7",
    demoResolution: { radius: 35, damage: 0, count: 1, scale: 1 },
  }),
  defineWeapon({
    id: "tonOfDirt",
    name: "Terra Nova",
    classicName: "Ton of Dirt",
    shortName: "Terra Nova",
    description: "Создаёт огромную массу грунта, меняя поле боя.",
    icon: "⬟",
    family: "dirt",
    category: "terrain-creation",
    delivery: "ballistic",
    effectKind: "terrain-fill",
    terrainEffect: "fill",
    price: 6_750,
    catalogPrice: 6_750,
    catalogBundleSize: 2,
    ammo: { kind: "finite", bundleSize: 2 },
    blastRadius: 70,
    armsLevel: 1,
    accent: "#40916c",
    secondaryAccent: "#95d5b2",
    demoResolution: { radius: 70, damage: 0, count: 1, scale: 1.45 },
  }),
  defineWeapon({
    id: "liquidDirt",
    name: "Earthflow",
    classicName: "Liquid Dirt",
    shortName: "Earthflow",
    description: "Текучий грунт заполняет низины и сглаживает поверхность.",
    icon: "∿",
    family: "dirt",
    category: "terrain-creation",
    delivery: "liquid",
    effectKind: "terrain-fill",
    terrainEffect: "fill",
    price: 5_000,
    catalogPrice: 5_000,
    catalogBundleSize: 10,
    ammo: { kind: "finite", bundleSize: 10 },
    blastRadius: null,
    armsLevel: 2,
    accent: "#52b788",
    secondaryAccent: "#d8f3dc",
    demoResolution: { radius: 34, damage: 0, count: 16, scale: 1.05 },
  }),
  defineWeapon({
    id: "dirtCharge",
    name: "Earth Fan",
    classicName: "Dirt Charge",
    shortName: "Earth Fan",
    description: "Выбрасывает клин грунта перед танком.",
    icon: "▷",
    family: "dirt",
    category: "terrain-creation",
    delivery: "tank-mounted",
    effectKind: "terrain-fill",
    terrainEffect: "fill",
    price: 5_000,
    catalogPrice: 5_000,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: null,
    armsLevel: 1,
    accent: "#2d6a4f",
    secondaryAccent: "#74c69d",
    demoResolution: { radius: 44, damage: 0, count: 1, scale: 1.08 },
  }),
  defineWeapon({
    id: "earthDisrupter",
    name: "Gravity Pulse",
    classicName: "Earth Disrupter",
    shortName: "Gravity Pulse",
    description: "Осаживает подвешенный грунт и рушит неустойчивые формы.",
    icon: "⇊",
    family: "earth-disrupter",
    category: "terrain-destruction",
    delivery: "radial",
    effectKind: "terrain-settle",
    terrainEffect: "settle",
    price: 5_000,
    catalogPrice: 5_000,
    catalogBundleSize: 10,
    ammo: { kind: "finite", bundleSize: 10 },
    blastRadius: null,
    armsLevel: 0,
    accent: "#9b5de5",
    secondaryAccent: "#cdb4db",
    demoResolution: { radius: 72, damage: 0, count: 1, scale: 1.12 },
  }),
  defineWeapon({
    id: "plasmaBlast",
    name: "Plasma Halo",
    classicName: "Plasma Blast",
    shortName: "Plasma Halo",
    description: "Батареи питают расширяющийся энергетический импульс.",
    icon: "◉",
    family: "energy",
    category: "energy",
    delivery: "radial",
    effectKind: "energy-blast",
    terrainEffect: "none",
    price: 9_000,
    catalogPrice: 9_000,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: Object.freeze({ min: 10, max: 75 }),
    armsLevel: 3,
    accent: "#00f5d4",
    secondaryAccent: "#9b5de5",
    demoResolution: { radius: 75, damage: 92, count: 1, scale: 1.5 },
  }),
  defineWeapon({
    id: "laser",
    name: "Sunline",
    classicName: "Laser",
    shortName: "Sunline",
    description: "Мгновенный прямой луч проходит сквозь землю и щиты.",
    icon: "━",
    family: "energy",
    category: "energy",
    delivery: "beam",
    effectKind: "beam",
    terrainEffect: "none",
    price: 5_000,
    catalogPrice: 5_000,
    catalogBundleSize: 5,
    ammo: { kind: "finite", bundleSize: 5 },
    blastRadius: null,
    armsLevel: 2,
    accent: "#ff006e",
    secondaryAccent: "#00f5d4",
    demoResolution: { radius: 3, damage: 62, count: 1, scale: 1.2 },
  }),
] satisfies readonly WeaponDefinition[]);

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
