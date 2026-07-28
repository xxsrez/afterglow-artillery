import type { WeaponId } from "./weapons";

export type DemoBehaviorKind =
  | "blast"
  | "leap-frog"
  | "funky"
  | "airburst"
  | "napalm"
  | "tracer"
  | "roller"
  | "riot-wedge"
  | "riot-bomb"
  | "digger"
  | "sandhog"
  | "dirt-sphere"
  | "liquid-dirt"
  | "dirt-wedge"
  | "settle"
  | "plasma"
  | "laser";

export interface DemoBehavior {
  readonly kind: DemoBehaviorKind;
  readonly tier: 1 | 2 | 3 | 4;
}

/**
 * Quick Demo strategy registry. The mapping affects mechanics, so it belongs
 * to the deterministic game layer rather than the React/Canvas adapter.
 */
export const DEMO_BEHAVIORS: Readonly<Record<WeaponId, DemoBehavior>> =
  Object.freeze({
    babyMissile: { kind: "blast", tier: 1 },
    missile: { kind: "blast", tier: 2 },
    babyNuke: { kind: "blast", tier: 3 },
    nuke: { kind: "blast", tier: 4 },
    leapFrog: { kind: "leap-frog", tier: 3 },
    funkyBomb: { kind: "funky", tier: 4 },
    mirv: { kind: "airburst", tier: 2 },
    deathsHead: { kind: "airburst", tier: 4 },
    napalm: { kind: "napalm", tier: 2 },
    hotNapalm: { kind: "napalm", tier: 4 },
    tracer: { kind: "tracer", tier: 1 },
    smokeTracer: { kind: "tracer", tier: 2 },
    babyRoller: { kind: "roller", tier: 1 },
    roller: { kind: "roller", tier: 2 },
    heavyRoller: { kind: "roller", tier: 3 },
    riotCharge: { kind: "riot-wedge", tier: 1 },
    riotBlast: { kind: "riot-wedge", tier: 2 },
    riotBomb: { kind: "riot-bomb", tier: 1 },
    heavyRiotBomb: { kind: "riot-bomb", tier: 2 },
    babyDigger: { kind: "digger", tier: 1 },
    digger: { kind: "digger", tier: 2 },
    heavyDigger: { kind: "digger", tier: 3 },
    babySandhog: { kind: "sandhog", tier: 1 },
    sandhog: { kind: "sandhog", tier: 2 },
    heavySandhog: { kind: "sandhog", tier: 3 },
    dirtClod: { kind: "dirt-sphere", tier: 1 },
    dirtBall: { kind: "dirt-sphere", tier: 2 },
    tonOfDirt: { kind: "dirt-sphere", tier: 3 },
    liquidDirt: { kind: "liquid-dirt", tier: 2 },
    dirtCharge: { kind: "dirt-wedge", tier: 2 },
    earthDisrupter: { kind: "settle", tier: 1 },
    plasmaBlast: { kind: "plasma", tier: 3 },
    laser: { kind: "laser", tier: 2 },
  });

export function getDemoBehavior(id: WeaponId): DemoBehavior {
  return DEMO_BEHAVIORS[id];
}
