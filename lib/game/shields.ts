import type { Vector2 } from "./types";

export type ShieldId =
  | "none"
  | "mag-deflector"
  | "shield"
  | "force-shield"
  | "heavy-shield"
  | "super-mag";

export type ShieldVisualShape =
  | "none"
  | "magnetic-arcs"
  | "solid-shell"
  | "vector-field"
  | "layered-shell"
  | "hybrid-field";

export interface ShieldDefinition {
  readonly id: ShieldId;
  readonly classicName: string | null;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly icon: string;
  readonly accent: string;
  readonly catalogPrice: number | null;
  readonly catalogBundleSize: number | null;
  readonly armsLevel: number | null;
  readonly confirmedRole: string;
  readonly demoProfile: {
    readonly capacity: number;
    readonly absorption: number;
    readonly fieldRadius: number;
    readonly deflectionX: number;
    readonly deflectionY: number;
    readonly deflectionCost: number;
    readonly laserImmune: boolean;
    readonly visualShape: ShieldVisualShape;
  };
}

export const SHIELDS = [
  {
    id: "none",
    classicName: null,
    name: "Без щита",
    shortName: "None",
    description: "Открытый корпус без защитного поля.",
    icon: "○",
    accent: "#82909a",
    catalogPrice: null,
    catalogBundleSize: null,
    armsLevel: null,
    confirmedRole: "Защитное средство не выбрано.",
    demoProfile: {
      capacity: 0,
      absorption: 0,
      fieldRadius: 0,
      deflectionX: 0,
      deflectionY: 0,
      deflectionCost: 0,
      laserImmune: false,
      visualShape: "none",
    },
  },
  {
    id: "mag-deflector",
    classicName: "Mag Deflector",
    name: "Arc Lifter",
    shortName: "Arc Lifter",
    description: "Магнитные дуги подбрасывают близкий projectile вверх.",
    icon: "⌁",
    accent: "#8ee9ff",
    catalogPrice: 10_000,
    catalogBundleSize: 2,
    armsLevel: 2,
    confirmedRole: "Толкает projectile вверх.",
    demoProfile: {
      capacity: 36,
      absorption: 0,
      fieldRadius: 58,
      deflectionX: 0,
      deflectionY: -38,
      deflectionCost: 8,
      laserImmune: false,
      visualShape: "magnetic-arcs",
    },
  },
  {
    id: "shield",
    classicName: "Shield",
    name: "Aegis Shell",
    shortName: "Aegis",
    description: "Цельная оболочка поглощает shieldable damage.",
    icon: "◯",
    accent: "#6de8ff",
    catalogPrice: 20_000,
    catalogBundleSize: 3,
    armsLevel: 3,
    confirmedRole: "Поглощает воздействие.",
    demoProfile: {
      capacity: 46,
      absorption: 1,
      fieldRadius: 0,
      deflectionX: 0,
      deflectionY: 0,
      deflectionCost: 0,
      laserImmune: false,
      visualShape: "solid-shell",
    },
  },
  {
    id: "force-shield",
    classicName: "Force Shield",
    name: "Vector Veil",
    shortName: "Vector",
    description: "Деформирует impact vector и частично поглощает остаток.",
    icon: "⟫",
    accent: "#a68dff",
    catalogPrice: 25_000,
    catalogBundleSize: 3,
    armsLevel: 3,
    confirmedRole: "Отклоняет projectile или воздействие.",
    demoProfile: {
      capacity: 42,
      absorption: 0.42,
      fieldRadius: 54,
      deflectionX: 30,
      deflectionY: -18,
      deflectionCost: 10,
      laserImmune: false,
      visualShape: "vector-field",
    },
  },
  {
    id: "heavy-shield",
    classicName: "Heavy Shield",
    name: "Bastion Layers",
    shortName: "Bastion",
    description: "Плотная многослойная оболочка с большой capacity.",
    icon: "◎",
    accent: "#ffb866",
    catalogPrice: 30_000,
    catalogBundleSize: 2,
    armsLevel: 4,
    confirmedRole: "Усиленное поглощение.",
    demoProfile: {
      capacity: 82,
      absorption: 1,
      fieldRadius: 0,
      deflectionX: 0,
      deflectionY: 0,
      deflectionCost: 0,
      laserImmune: false,
      visualShape: "layered-shell",
    },
  },
  {
    id: "super-mag",
    classicName: "Super Mag",
    name: "Magnetar Crown",
    shortName: "Magnetar",
    description: "Комбинирует magnetic deflection, shell и Laser immunity.",
    icon: "✦",
    accent: "#ffe46d",
    catalogPrice: 40_000,
    catalogBundleSize: 2,
    armsLevel: 4,
    confirmedRole: "Сочетает защитные свойства; иммунен к Laser.",
    demoProfile: {
      capacity: 68,
      absorption: 0.72,
      fieldRadius: 64,
      deflectionX: 18,
      deflectionY: -34,
      deflectionCost: 9,
      laserImmune: true,
      visualShape: "hybrid-field",
    },
  },
] as const satisfies readonly ShieldDefinition[];

export type ShieldDamageKind =
  | "blast"
  | "napalm"
  | "underground"
  | "plasma"
  | "laser"
  | "fall";

export type ShieldEvent =
  | {
      readonly type: "absorb" | "break";
      readonly shieldId: ShieldId;
      readonly absorbed: number;
      readonly healthDamage: number;
      readonly remainingCapacity: number;
    }
  | {
      readonly type: "deflect";
      readonly shieldId: ShieldId;
      readonly from: Vector2;
      readonly to: Vector2;
      readonly remainingCapacity: number;
      readonly broken: boolean;
    }
  | {
      readonly type: "bypass";
      readonly shieldId: ShieldId;
      readonly reason: "self-direct" | "weapon" | "no-absorption";
      readonly healthDamage: number;
      readonly remainingCapacity: number;
    }
  | {
      readonly type: "laser-immunity";
      readonly shieldId: "super-mag";
      readonly remainingCapacity: number;
    };

export interface ShieldDamageResult {
  readonly healthDamage: number;
  readonly remainingCapacity: number;
  readonly event: ShieldEvent | null;
}

export interface ShieldDeflectionResult {
  readonly point: Vector2;
  readonly remainingCapacity: number;
  readonly event: ShieldEvent | null;
}

export function getShield(id: ShieldId): ShieldDefinition {
  const shield = SHIELDS.find((candidate) => candidate.id === id);
  if (!shield) {
    throw new Error(`Unknown shield: ${id}`);
  }
  return shield;
}

export function shieldCapacity(
  shieldId: ShieldId,
  bonusCapacity = 0,
): number {
  return Math.max(
    0,
    getShield(shieldId).demoProfile.capacity + bonusCapacity,
  );
}

export function resolveShieldDamage(
  state: {
    readonly shieldId: ShieldId;
    readonly capacity: number;
  },
  context: {
    readonly incomingDamage: number;
    readonly kind: ShieldDamageKind;
    readonly ownerIsTarget: boolean;
    readonly directHit: boolean;
    readonly bypassFraction?: number;
  },
): ShieldDamageResult {
  const damage = Math.max(0, context.incomingDamage);
  const capacity = Math.max(0, state.capacity);
  const profile = getShield(state.shieldId).demoProfile;

  if (damage === 0) {
    return {
      healthDamage: 0,
      remainingCapacity: capacity,
      event: null,
    };
  }

  if (context.ownerIsTarget && context.directHit) {
    return {
      healthDamage: damage,
      remainingCapacity: capacity,
      event: {
        type: "bypass",
        shieldId: state.shieldId,
        reason: "self-direct",
        healthDamage: damage,
        remainingCapacity: capacity,
      },
    };
  }

  if (context.kind === "laser" && profile.laserImmune) {
    return {
      healthDamage: 0,
      remainingCapacity: capacity,
      event: {
        type: "laser-immunity",
        shieldId: "super-mag",
        remainingCapacity: capacity,
      },
    };
  }

  const bypassFraction =
    context.kind === "fall"
      ? 1
      : Math.max(0, Math.min(1, context.bypassFraction ?? 0));
  const absorption = profile.absorption * (1 - bypassFraction);

  if (state.shieldId === "none" || capacity <= 0 || absorption <= 0) {
    return {
      healthDamage: damage,
      remainingCapacity: capacity,
      event:
        state.shieldId === "none"
          ? null
          : {
              type: "bypass",
              shieldId: state.shieldId,
              reason: bypassFraction >= 1 ? "weapon" : "no-absorption",
              healthDamage: damage,
              remainingCapacity: capacity,
            },
    };
  }

  const absorbed = Math.min(capacity, damage * absorption);
  const remainingCapacity = Math.max(0, capacity - absorbed);
  const healthDamage = Math.max(0, damage - absorbed);
  const broken = remainingCapacity === 0 && absorbed > 0;

  return {
    healthDamage,
    remainingCapacity,
    event: {
      type: broken ? "break" : "absorb",
      shieldId: state.shieldId,
      absorbed,
      healthDamage,
      remainingCapacity,
    },
  };
}

export function resolveShieldDeflection(
  state: {
    readonly shieldId: ShieldId;
    readonly capacity: number;
  },
  context: {
    readonly impact: Vector2;
    readonly tankCenter: Vector2;
    readonly ownerIsTarget: boolean;
    readonly incomingDirection: -1 | 1;
  },
): ShieldDeflectionResult {
  const profile = getShield(state.shieldId).demoProfile;
  const capacity = Math.max(0, state.capacity);
  const proximity = Math.hypot(
    context.impact.x - context.tankCenter.x,
    context.impact.y - context.tankCenter.y,
  );

  if (
    context.ownerIsTarget ||
    capacity <= 0 ||
    profile.fieldRadius <= 0 ||
    proximity > profile.fieldRadius ||
    profile.deflectionY === 0
  ) {
    return {
      point: context.impact,
      remainingCapacity: capacity,
      event: null,
    };
  }

  const horizontalDirection =
    context.impact.x === context.tankCenter.x
      ? context.incomingDirection
      : context.impact.x < context.tankCenter.x
        ? -1
        : 1;
  const point = {
    x: context.impact.x + profile.deflectionX * horizontalDirection,
    y: context.impact.y + profile.deflectionY,
  };
  const remainingCapacity = Math.max(
    0,
    capacity - profile.deflectionCost,
  );

  return {
    point,
    remainingCapacity,
    event: {
      type: "deflect",
      shieldId: state.shieldId,
      from: context.impact,
      to: point,
      remainingCapacity,
      broken: remainingCapacity === 0,
    },
  };
}
