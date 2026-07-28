import type { TerrainBounds, TerrainGrid } from "./terrain";
import type { WeaponId } from "./weapons";

export type TankId = string;
export type ShotId = string;
export type ShotDirection = -1 | 1;

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export type Inventory = Partial<Record<WeaponId, number>>;

export interface Tank {
  readonly id: TankId;
  name: string;
  x: number;
  y: number;
  direction: ShotDirection;
  angleDegrees: number;
  power: number;
  health: number;
  maxHealth: number;
  credits: number;
  inventory: Inventory;
}

export type MatchPhase =
  | "setup"
  | "shop"
  | "aiming"
  | "resolving"
  | "round-end"
  | "match-end";

export interface Match {
  readonly id: string;
  readonly seed: number;
  phase: MatchPhase;
  round: number;
  readonly totalRounds: number;
  turn: number;
  activeTankId: TankId;
  wind: number;
  gravity: number;
  tanks: Tank[];
  terrain: TerrainGrid;
}

export interface ShotCommand {
  readonly shotId: ShotId;
  readonly tankId: TankId;
  readonly weaponId: WeaponId;
  readonly origin: Vector2;
  readonly direction: ShotDirection;
  readonly angleDegrees: number;
  readonly power: number;
  readonly wind: number;
  readonly gravity: number;
  readonly seed: number;
}

interface ShotEventBase {
  readonly shotId: ShotId;
  /** Simulation seconds since launch. */
  readonly at: number;
}

export type ShotEvent =
  | (ShotEventBase & {
      readonly type: "shot-launched";
      readonly command: ShotCommand;
    })
  | (ShotEventBase & {
      readonly type: "projectile-moved";
      readonly position: Vector2;
      readonly velocity: Vector2;
    })
  | (ShotEventBase & {
      readonly type: "payload-split";
      readonly position: Vector2;
      readonly childShotIds: readonly ShotId[];
    })
  | (ShotEventBase & {
      readonly type: "projectile-collided";
      readonly position: Vector2;
      readonly with: "terrain" | "tank" | "bounds";
      readonly tankId?: TankId;
    })
  | (ShotEventBase & {
      readonly type: "terrain-changed";
      readonly mode: "carve" | "fill";
      readonly bounds: TerrainBounds | null;
      readonly changedCells: number;
    })
  | (ShotEventBase & {
      readonly type: "tank-damaged";
      readonly tankId: TankId;
      readonly amount: number;
      readonly remainingHealth: number;
    })
  | (ShotEventBase & {
      readonly type: "shot-resolved";
    });
