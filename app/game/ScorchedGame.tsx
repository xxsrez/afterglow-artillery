"use client";

import {
  CLASSIC_INTEREST_RATE,
  EXPERIMENTAL_ULTIMATES,
  MAX_INVENTORY,
  Material,
  SeededRandom,
  SHIELDS,
  TerrainGrid,
  WEAPONS,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORLD_WIDTH,
  DEFAULT_DEMO_MATCH_MODE,
  DEMO_BEHAVIORS,
  airburstImpactPlan,
  airburstPayloadProfile,
  availableSelectedWeapon,
  applyInterest,
  buildDiggerPath,
  buildFlowPoints,
  buildFunkyChain,
  buildRollPath,
  buildUndergroundFan,
  calculateInterest,
  consumePlayerWeapon,
  createDemoInventory,
  generateBattlefield,
  getDemoBehavior,
  getShield,
  getExperimentalUltimate,
  getWeapon,
  getWeaponEffectProfile,
  isExperimentalUltimateId,
  isInfiniteArsenalMode,
  isPlayerWeaponAvailable,
  leapFrogImpactPlan,
  leapFrogImpactProfiles,
  linePath,
  nextPlayerIndex,
  pointAlongPathInto,
  purchaseWeapon,
  quoteWeaponPurchase,
  quoteWeaponSale,
  restoreAvailableSelectedWeapon,
  resolveRadialDamage,
  resolveExperimentalUltimate,
  resolveShieldDamage,
  resolveShieldDeflection,
  selectPlayerWeapon,
  sellWeapon,
  samplePath,
  shouldOpenInterroundShop,
  shieldCapacity,
  simulateTrajectory,
  terrainSurfaceOrFloor,
  trajectoryApexIndex,
  updatePlayerAim,
  type DemoBehaviorKind,
  type DemoMatchMode,
  type BattlefieldSpawn,
  type ExperimentalResolutionResult,
  type ExperimentalUltimateId,
  type ShieldDamageKind,
  type ShieldEvent,
  type ShieldId,
  type Tank,
  type TerrainBounds,
  type TerrainEdit,
  type TrajectoryPoint,
  type Vector2,
  type WeaponEffectProfile,
  type WeaponId,
} from "@/lib/game";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import {
  averagePoints,
  clampCamera,
  clientPointToContainedViewport,
  createCamera,
  flightFocusPoint,
  moveCameraToward,
  panCameraByScreenDelta,
  zoomCameraAtScreenPoint,
  type CameraState,
} from "./camera";
import {
  angleDeltaForScreenDirection,
  barrelEndX,
  getGameKeyboardAction,
} from "./keyboard-controls";
import {
  drawParticles,
  spawnImpactParticles,
  updateParticles,
  type EffectLevel,
  type Particle,
} from "./particle-system";
import {
  DEFAULT_AUDIO_PREFERENCES,
  createAudioDirector,
  damageBucket,
  loadAudioPreferences,
  saveAudioPreferences,
  type AudioDirector,
  type AudioMaterial,
  type AudioPreferences,
  type GameAudioEvent,
  type MusicState,
  type RuntimeAudioContextState,
  type UiAudioCue,
} from "./audio-system";
import {
  scheduleSelectorFocus,
  type SelectorCloseOutcome,
} from "./selector-focus";
import {
  isShieldSelectorCloseKey,
  nextShieldFocus,
} from "./shield-selector";
import {
  WEAPON_SELECTOR_FILTERS,
  isWeaponSelectorCloseKey,
  nextWeaponFocus,
  weaponAmmoCount,
  weaponCatalogSubtitle,
  weaponCategoryLabel,
  weaponsForSelectorFilter,
  type WeaponSelectorFilterId,
} from "./weapon-selector";
import styles from "./ScorchedGame.module.css";

const TOTAL_ROUNDS = 3;
const MAX_TURNS_PER_ROUND = 12;
const TANK_HALF_HEIGHT = 11;

const PLAYER_COLORS = ["#d8ff45", "#ff6658"] as const;
const PLAYER_NAMES = ["Пилот Лайм", "Пилот Коралл"] as const;

const DEMO_PAYOUT_DISCLOSURE =
  "Выплаты Quick Match — демонстрационное приближение: официальные денежные коэффициенты урона, убийства и выживания неизвестны.";

type GamePhase =
  | "intro"
  | "aiming"
  | "firing"
  | "roundEnd"
  | "shop"
  | "matchEnd";

type PlayableWeaponId = WeaponId | ExperimentalUltimateId;

interface PlayerTank extends Tank {
  selectedExperimental: ExperimentalUltimateId | null;
  color: string;
  shieldId: ShieldId;
  shield: number;
  maxShield: number;
  shieldResponse: ShieldEvent["type"] | null;
  wins: number;
  damageDealt: number;
  bonusHealth: number;
  reserveShield: number;
  bankAtRoundStart: number;
  lastInterest: number;
}

interface ShieldMatchEvent {
  readonly player: 0 | 1;
  readonly event: ShieldEvent;
}

interface GameModel {
  seed: number;
  mode: DemoMatchMode;
  phase: GamePhase;
  round: number;
  activePlayer: 0 | 1;
  shopPlayer: 0 | 1;
  terrain: TerrainGrid;
  terrainRevision: number;
  terrainDirtyRegion: TerrainBounds | "full" | null;
  wind: number;
  turn: number;
  tanks: [PlayerTank, PlayerTank];
  roundWinner: 0 | 1 | null;
  lastRoundWasDraw: boolean;
  shieldEvents: ShieldMatchEvent[];
  paused: boolean;
  audio: AudioPreferences;
  audioAvailable: boolean;
  audioDiagnostic: string | null;
  reducedMotion: boolean;
  effectLevel: EffectLevel;
  message: string;
}

type SegmentStyle =
  | "ballistic"
  | "cluster-parent"
  | "cluster-child"
  | "funky"
  | "roller"
  | "digger"
  | "napalm"
  | "dirt"
  | "tracer"
  | "smoke-tracer"
  | "riot"
  | "sandhog"
  | "energy"
  | "laser"
  | "settle"
  | "experimental";

interface FlightSegment {
  path: readonly Vector2[];
  startsAt: number;
  endsAt: number;
  style: SegmentStyle;
}

interface ShotMechanicalPaths {
  readonly digger: readonly Vector2[];
  readonly sandhog: readonly (readonly Vector2[])[];
  readonly laser: readonly Vector2[];
}

interface ShotVisual {
  weaponId: PlayableWeaponId;
  behavior: DemoBehaviorKind | "experimental";
  owner: 0 | 1;
  elapsedMs: number;
  duration: number;
  resolvedAt: number;
  endsAt: number;
  resolved: boolean;
  completed: boolean;
  segments: FlightSegment[];
  impactPoints: Vector2[];
  impactTimes: number[];
  finalPoint: Vector2;
  flowPoints: Vector2[];
  origin: Vector2;
  fizzled: boolean;
  seed: number;
  mechanicalPaths: ShotMechanicalPaths;
  experimentalResult?: ExperimentalResolutionResult;
}

interface TerrainCache {
  canvas: HTMLCanvasElement;
  minimap: HTMLCanvasElement;
  revision: number;
}

interface CameraGesture {
  readonly pointers: Map<number, Vector2>;
  pinchDistance: number | null;
  pinchMidpoint: Vector2 | null;
  minimapPointerId: number | null;
}

const CAMERA_VIEWPORT = {
  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,
} as const;
const MINIMAP_BOUNDS = {
  x: VIEWPORT_WIDTH / 2 - 145,
  y: 119,
  width: 290,
  height: 58,
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const distance = (a: Vector2, b: Vector2) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const CREDITS_FORMATTER = new Intl.NumberFormat("ru-RU");

const formatCredits = (credits: number) =>
  CREDITS_FORMATTER.format(Math.max(0, Math.round(credits)));

function formatBlastRadius(
  blastRadius: (typeof WEAPONS)[number]["blastRadius"],
): string {
  if (blastRadius === null) {
    return "N/A";
  }
  if (typeof blastRadius === "number") {
    return `${blastRadius}`;
  }
  if (Array.isArray(blastRadius)) {
    return blastRadius.join(" / ");
  }
  if ("min" in blastRadius) {
    return `${blastRadius.min}–${blastRadius.max}`;
  }
  return blastRadius.join(" / ");
}

function weaponStatus(id: WeaponId): string {
  const weapon = getWeapon(id);
  const behavior = getDemoBehavior(id).kind;
  const statusByBehavior: Record<DemoBehaviorKind, string> = {
    blast: "Чистая баллистическая траектория. Радиус зависит от tier.",
    "leap-frog": "Три боеголовки уйдут одна за другой.",
    funky: "Seeded chain готовит 10–14 цветных субвзрывов.",
    airburst: "Carrier должен пережить подъём до апогея.",
    napalm: "Горячий поток растечётся по поверхности и низинам.",
    tracer: "Пристрелочный выстрел: урона и воронки не будет.",
    roller: "Заряд после касания ищет низину по форме рельефа.",
    "riot-wedge": "Клин раскрывается сразу от башни, без баллистики.",
    "riot-bomb": "Сфера удалит только грунт, без прямого урона.",
    digger: "Бур продолжит путь под поверхностью.",
    sandhog: "Подземные боеголовки разойдутся веером под shield.",
    "dirt-sphere": "Снаряд создаст сферу твёрдого грунта.",
    "liquid-dirt": "Жидкий грунт заполнит локальные низины.",
    "dirt-wedge": "Клин грунта вырастет прямо от башни.",
    settle: "Импульс осадит доступный подвешенный грунт.",
    plasma: "Радиальный импульс выйдет из собственного танка.",
    laser: "Прямая линия пройдёт сквозь грунт и танки.",
  };
  return `${weapon.name}: ${statusByBehavior[behavior]}`;
}

const surfaceForTank = terrainSurfaceOrFloor;

function shotCameraTarget(
  shot: ShotVisual,
  progress: number,
): Vector2 {
  if (progress >= shot.resolvedAt) {
    return averagePoints(
      shot.impactPoints.length > 0
        ? shot.impactPoints
        : [shot.finalPoint],
      shot.finalPoint,
    );
  }

  return flightFocusPoint(shot.segments, progress, shot.origin);
}

function pointerDistance(first: Vector2, second: Vector2): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointerMidpoint(first: Vector2, second: Vector2): Vector2 {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function canvasPointFromClient(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): Vector2 {
  return clientPointToContainedViewport(
    { x: clientX, y: clientY },
    canvas.getBoundingClientRect(),
    CAMERA_VIEWPORT,
  );
}

function pointInsideMinimap(point: Vector2): boolean {
  return (
    point.x >= MINIMAP_BOUNDS.x &&
    point.x <= MINIMAP_BOUNDS.x + MINIMAP_BOUNDS.width &&
    point.y >= MINIMAP_BOUNDS.y &&
    point.y <= MINIMAP_BOUNDS.y + MINIMAP_BOUNDS.height
  );
}

function minimapPointToWorld(
  point: Vector2,
  terrain: TerrainGrid,
): Vector2 {
  return {
    x:
      ((point.x - MINIMAP_BOUNDS.x) / MINIMAP_BOUNDS.width) *
      terrain.width,
    y:
      ((point.y - MINIMAP_BOUNDS.y) / MINIMAP_BOUNDS.height) *
      terrain.height,
  };
}

function cameraWorldForTerrain(terrain: TerrainGrid) {
  return { width: terrain.width, height: terrain.height };
}

function cameraTargetForTank(tank: PlayerTank): Vector2 {
  return {
    x: tank.x,
    y: tank.y - 72,
  };
}

function initialInventory(): Partial<Record<WeaponId, number>> {
  return createDemoInventory();
}

function makePlayer(
  index: 0 | 1,
  spawn: BattlefieldSpawn,
): PlayerTank {
  return {
    id: `player-${index + 1}`,
    name: PLAYER_NAMES[index],
    x: spawn.x,
    y: spawn.y,
    direction: index === 0 ? 1 : -1,
    selectedWeapon: "babyMissile",
    selectedExperimental: null,
    angleDegrees: 48,
    power: 400,
    health: 100,
    maxHealth: 100,
    credits: 0,
    inventory: initialInventory(),
    color: PLAYER_COLORS[index],
    shieldId: "shield",
    shield: shieldCapacity("shield"),
    maxShield: shieldCapacity("shield"),
    shieldResponse: null,
    wins: 0,
    damageDealt: 0,
    bonusHealth: 0,
    reserveShield: 0,
    bankAtRoundStart: 0,
    lastInterest: 0,
  };
}

function nextWind(seed: number, round: number): number {
  const random = new SeededRandom(`${seed}:wind:${round}`);
  const raw = random.integer(-90, 91);
  return Math.abs(raw) < 12 ? (raw < 0 ? -12 : 12) : raw;
}

function createGame(seed = 41_705): GameModel {
  const battlefield = generateBattlefield(seed);
  const { terrain, spawns } = battlefield;

  return {
    seed,
    mode: DEFAULT_DEMO_MATCH_MODE,
    phase: "intro",
    round: 1,
    activePlayer: 0,
    shopPlayer: 0,
    terrain,
    terrainRevision: 0,
    terrainDirtyRegion: "full",
    wind: nextWind(seed, 1),
    turn: 0,
    tanks: [
      makePlayer(0, spawns[0]),
      makePlayer(1, spawns[1]),
    ],
    roundWinner: null,
    lastRoundWasDraw: false,
    shieldEvents: [],
    paused: false,
    audio: { ...DEFAULT_AUDIO_PREFERENCES },
    audioAvailable: true,
    audioDiagnostic: null,
    reducedMotion: false,
    effectLevel: "full",
    message: "Настройте угол и силу. Первый выстрел за пилотом Лайм.",
  };
}

function weaponAmmo(tank: PlayerTank, weaponId: WeaponId): number {
  return weaponAmmoCount(tank.inventory, weaponId);
}

function canUseWeapon(
  model: GameModel,
  tank: PlayerTank,
  weaponId: WeaponId,
): boolean {
  return isPlayerWeaponAvailable(tank, weaponId, model.mode);
}

function projectileOrigin(tank: PlayerTank): Vector2 {
  const radians = (tank.angleDegrees * Math.PI) / 180;
  return {
    x: barrelEndX(tank.x, tank.angleDegrees, tank.direction, 24),
    y: tank.y - 7 - Math.sin(radians) * 24,
  };
}

function ballisticPath(
  model: GameModel,
  tank: PlayerTank,
  origin = projectileOrigin(tank),
  angleDegrees = tank.angleDegrees,
  power = tank.power,
  direction = tank.direction,
): readonly TrajectoryPoint[] {
  return simulateTrajectory(model.terrain, {
    origin,
    angleDegrees,
    power,
    direction,
    wind: model.wind,
    projectileRadius: 2,
    maxTime: 9,
  }).points;
}

function buildShot(
  model: GameModel,
  owner: 0 | 1,
  weaponId: WeaponId,
): ShotVisual {
  const tank = model.tanks[owner];
  const weapon = getWeapon(weaponId);
  const behavior = DEMO_BEHAVIORS[weaponId];
  const resolution = weapon.demoResolution;
  const effectProfile = getWeaponEffectProfile(weaponId);
  const shotSeed = model.seed + model.round * 1_003 + model.turn * 37;
  const random = new SeededRandom(`${shotSeed}:${weaponId}:mechanics`);
  const origin = projectileOrigin(tank);
  const trajectory = ballisticPath(model, tank);
  const basePath = samplePath(trajectory);
  const impact =
    basePath[basePath.length - 1] ?? projectileOrigin(tank);
  const reduced = model.reducedMotion;
  const durationScale = reduced ? 0.7 : 1;
  const segments: FlightSegment[] = [];
  const impactPoints: Vector2[] = [];
  const impactTimes: number[] = [];
  let finalPoint = impact;
  let flowPoints: readonly Vector2[] = [];
  let fizzled = false;
  let resolvedAt = 0.62;
  let endsAt = 0.94;
  let duration = 2_900 * durationScale;
  let diggerPath: readonly Vector2[] = [];
  let sandhogPaths: readonly (readonly Vector2[])[] = [];
  let laserPath: readonly Vector2[] = [];

  if (behavior.kind === "blast" || behavior.kind === "riot-bomb") {
    segments.push({
      path: basePath,
      startsAt: 0.08,
      endsAt: 0.57,
      style: "ballistic",
    });
    impactPoints.push(impact);
    impactTimes.push(0.59);
    resolvedAt = 0.59;
    duration = (2_250 + behavior.tier * 110) * durationScale;
  }

  if (behavior.kind === "leap-frog") {
    const powerOffsets = [-0.035, 0, 0.035] as const;
    powerOffsets.forEach((powerOffset, index) => {
      const childTrajectory = ballisticPath(
        model,
        tank,
        origin,
        clamp(tank.angleDegrees + index - 1, 5, 88),
        tank.power * (1 + powerOffset),
      );
      const childPath = samplePath(childTrajectory);
      const childImpact = childPath[childPath.length - 1] ?? impact;
      const startsAt = 0.05 + index * 0.14;
      const endsAt = 0.52 + index * 0.14;
      segments.push({
        path: childPath,
        startsAt,
        endsAt,
        style: "cluster-child",
      });
      impactPoints.push(childImpact);
      impactTimes.push(endsAt + 0.015);
    });
    finalPoint = impactPoints[1] ?? impact;
    resolvedAt = 0.82;
    endsAt = 0.97;
    duration = 3_500 * durationScale;
  }

  if (behavior.kind === "funky") {
    segments.push({
      path: basePath,
      startsAt: 0.05,
      endsAt: 0.45,
      style: "funky",
    });
    const chain = buildFunkyChain(
      model.terrain,
      impact,
      random.integer(10, 15),
      shotSeed,
    );
    chain.forEach((point, index) => {
      impactPoints.push(point);
      // Nodes resolve in four soft visual waves. This keeps the chain colorful
      // without producing a rapid full-brightness flash sequence.
      const moment =
        0.5 + Math.floor(index / 4) * 0.14 + (index % 4) * 0.008;
      impactTimes.push(moment);
      if (index > 0) {
        segments.push({
          path: linePath(chain[index - 1] as Vector2, point, 12),
          startsAt: Math.max(0.46, moment - 0.05),
          endsAt: moment,
          style: "funky",
        });
      }
    });
    finalPoint = impact;
    resolvedAt = 0.82;
    endsAt = 0.99;
    duration = 4_100 * durationScale;
  }

  if (behavior.kind === "airburst") {
    if (weaponId !== "mirv" && weaponId !== "deathsHead") {
      throw new Error(`Unsupported airburst payload: ${weaponId}`);
    }
    const apexIndex = trajectoryApexIndex(trajectory);
    const payload = airburstPayloadProfile(weaponId);
    const childCount = payload.childCount;

    if (apexIndex === null) {
      segments.push({
        path: basePath,
        startsAt: 0.06,
        endsAt: 0.54,
        style: "cluster-parent",
      });
      finalPoint = impact;
      fizzled = true;
      resolvedAt = 0.56;
      endsAt = 0.82;
      duration = 2_500 * durationScale;
    } else {
      const apex = trajectory[apexIndex] as TrajectoryPoint;
      const parentPath = samplePath(trajectory.slice(0, apexIndex + 1), 80);
      segments.push({
        path: parentPath,
        startsAt: 0.06,
        endsAt: 0.39,
        style: "cluster-parent",
      });

      const baseSpeed = Math.max(
        245,
        Math.hypot(apex.velocityX, apex.velocityY) / 0.75,
      );
      const baseAngle = 34;
      const baseDirection = apex.velocityX >= 0 ? 1 : -1;

      for (let index = 0; index < childCount; index += 1) {
        const centered = index - (childCount - 1) / 2;
        const offset = centered * (weaponId === "deathsHead" ? 5.25 : 9);
        const child = simulateTrajectory(model.terrain, {
          origin: { x: apex.x, y: apex.y },
          angleDegrees: clamp(baseAngle + offset, 4, 86),
          power: baseSpeed * (1 + centered * 0.018),
          direction: baseDirection,
          wind: model.wind,
          projectileRadius: weaponId === "deathsHead" ? 2.2 : 1.5,
          maxTime: 7,
        }).points;
        const childPath = samplePath(child, 100);
        const childImpact =
          childPath[childPath.length - 1] ?? { x: apex.x, y: apex.y };
        segments.push({
          path: childPath,
          startsAt: 0.41,
          endsAt: 0.76,
          style: "cluster-child",
        });
        impactPoints.push(childImpact);
        impactTimes.push(0.77 + index * 0.008);
      }

      finalPoint = impactPoints[Math.floor(childCount / 2)] ?? impact;
      resolvedAt = 0.78;
      endsAt = 0.98;
      duration =
        (weaponId === "deathsHead" ? 3_900 : 3_350) * durationScale;
    }
  }

  if (behavior.kind === "roller") {
    const rollPath = buildRollPath(model.terrain, impact);
    segments.push(
      {
        path: basePath,
        startsAt: 0.07,
        endsAt: 0.42,
        style: "roller",
      },
      {
        path: rollPath,
        startsAt: 0.43,
        endsAt: 0.73,
        style: "roller",
      },
    );
    finalPoint = rollPath[rollPath.length - 1] ?? impact;
    impactPoints.push(finalPoint);
    impactTimes.push(0.75);
    resolvedAt = 0.75;
    duration = (2_900 + behavior.tier * 100) * durationScale;
  }

  if (behavior.kind === "digger") {
    const lastTrajectoryPoint =
      trajectory[trajectory.length - 1] ??
      ({ velocityX: tank.direction, velocityY: 1 } as TrajectoryPoint);
    const tunnelPath = buildDiggerPath(model.terrain, impact, {
      x: lastTrajectoryPoint.velocityX,
      y: lastTrajectoryPoint.velocityY,
    });
    const tierLength = Math.round(
      tunnelPath.length * (0.58 + behavior.tier * 0.14),
    );
    const tierPath = tunnelPath.slice(0, tierLength);
    diggerPath = tierPath;
    segments.push(
      {
        path: basePath,
        startsAt: 0.07,
        endsAt: 0.37,
        style: "digger",
      },
      {
        path: tierPath,
        startsAt: 0.38,
        endsAt: 0.76,
        style: "digger",
      },
    );
    finalPoint = tierPath[tierPath.length - 1] ?? impact;
    impactPoints.push(finalPoint);
    impactTimes.push(0.77);
    resolvedAt = 0.77;
    duration = (2_900 + behavior.tier * 120) * durationScale;
  }

  if (behavior.kind === "sandhog") {
    segments.push({
      path: basePath,
      startsAt: 0.05,
      endsAt: 0.35,
      style: "ballistic",
    });
    const paths = buildUndergroundFan(
      model.terrain,
      impact,
      resolution.count,
      behavior.tier,
      shotSeed,
    );
    sandhogPaths = paths;
    paths.forEach((path, index) => {
      segments.push({
        path,
        startsAt: 0.37,
        endsAt: 0.73,
        style: "sandhog",
      });
      const endpoint = path[path.length - 1] ?? impact;
      impactPoints.push(endpoint);
      impactTimes.push(0.74 + index * 0.012);
    });
    finalPoint = impactPoints[Math.floor(impactPoints.length / 2)] ?? impact;
    resolvedAt = 0.8;
    endsAt = 0.98;
    duration = (3_250 + behavior.tier * 180) * durationScale;
  }

  if (behavior.kind === "napalm" || behavior.kind === "liquid-dirt") {
    segments.push({
      path: basePath,
      startsAt: 0.06,
      endsAt: 0.5,
      style: behavior.kind === "napalm" ? "napalm" : "dirt",
    });
    const halfWidth =
      behavior.kind === "napalm"
        ? Math.round(effectProfile.mechanicalRadius * 1.35)
        : effectProfile.mechanicalRadius;
    flowPoints = buildFlowPoints(model.terrain, impact, halfWidth);
    impactPoints.push(impact);
    impactTimes.push(0.55);
    finalPoint = impact;
    resolvedAt = 0.55;
    endsAt = 0.97;
    duration =
      (behavior.kind === "napalm" ? 3_350 + behavior.tier * 90 : 3_250) *
      durationScale;
  }

  if (behavior.kind === "tracer") {
    segments.push({
      path: basePath,
      startsAt: 0.04,
      endsAt: 0.76,
      style: weaponId === "smokeTracer" ? "smoke-tracer" : "tracer",
    });
    finalPoint = impact;
    impactPoints.push(impact);
    impactTimes.push(0.78);
    resolvedAt = 0.78;
    endsAt = 0.92;
    duration = 2_150 * durationScale;
  }

  if (behavior.kind === "dirt-sphere") {
    segments.push({
      path: basePath,
      startsAt: 0.07,
      endsAt: 0.54,
      style: "dirt",
    });
    impactPoints.push(impact);
    impactTimes.push(0.58);
    resolvedAt = 0.58;
    endsAt = 0.96;
    duration = (2_750 + behavior.tier * 110) * durationScale;
  }

  if (behavior.kind === "riot-wedge" || behavior.kind === "dirt-wedge") {
    const radians = (tank.angleDegrees * Math.PI) / 180;
    const length = Math.max(36, resolution.radius);
    const end = {
      x: clamp(
        tank.x + Math.cos(radians) * tank.direction * length,
        4,
        model.terrain.width - 4,
      ),
      y: clamp(
        tank.y - 7 - Math.sin(radians) * length,
        4,
        model.terrain.height - 4,
      ),
    };
    segments.push({
      path: linePath({ x: tank.x, y: tank.y - 7 }, end, 36),
      startsAt: 0.14,
      endsAt: 0.52,
      style: behavior.kind === "riot-wedge" ? "riot" : "dirt",
    });
    finalPoint = end;
    impactPoints.push(end);
    impactTimes.push(0.54);
    resolvedAt = 0.54;
    endsAt = 0.88;
    duration = 1_750 * durationScale;
  }

  if (behavior.kind === "settle") {
    const center = {
      x: model.terrain.width / 2,
      y: model.terrain.height / 2,
    };
    segments.push({
      path: linePath(
        { x: center.x, y: 30 },
        { x: center.x, y: model.terrain.height - 12 },
      ),
      startsAt: 0.12,
      endsAt: 0.64,
      style: "settle",
    });
    finalPoint = center;
    impactPoints.push(center);
    impactTimes.push(0.65);
    resolvedAt = 0.65;
    endsAt = 0.94;
    duration = 2_400 * durationScale;
  }

  if (behavior.kind === "plasma") {
    const center = { x: tank.x, y: tank.y - 5 };
    segments.push({
      path: [center, center],
      startsAt: 0.16,
      endsAt: 0.62,
      style: "energy",
    });
    finalPoint = center;
    impactPoints.push(center);
    impactTimes.push(0.63);
    resolvedAt = 0.63;
    endsAt = 0.94;
    duration = 2_050 * durationScale;
  }

  if (behavior.kind === "laser") {
    const radians = (tank.angleDegrees * Math.PI) / 180;
    const start = { x: tank.x, y: tank.y - 8 };
    const end = {
      x:
        start.x +
        Math.cos(radians) * tank.direction * model.terrain.width * 1.35,
      y: start.y - Math.sin(radians) * model.terrain.width * 1.35,
    };
    laserPath = linePath(start, end, 180);
    segments.push({
      path: laserPath,
      startsAt: 0.18,
      endsAt: 0.7,
      style: "laser",
    });
    finalPoint = end;
    impactPoints.push(end);
    impactTimes.push(0.7);
    resolvedAt = 0.7;
    endsAt = 0.92;
    duration = 1_700 * durationScale;
  }

  if (impactTimes.length === 0) {
    impactTimes.push(resolvedAt);
  }

  return {
    weaponId,
    behavior: behavior.kind,
    owner,
    elapsedMs: 0,
    duration,
    resolvedAt,
    endsAt,
    resolved: false,
    completed: false,
    segments,
    impactPoints,
    impactTimes,
    finalPoint,
    flowPoints: [...flowPoints],
    origin,
    fizzled,
    seed: shotSeed,
    mechanicalPaths: {
      digger: diggerPath,
      sandhog: sandhogPaths,
      laser: laserPath,
    },
  };
}

function buildExperimentalShot(
  model: GameModel,
  owner: 0 | 1,
  ultimateId: ExperimentalUltimateId,
): ShotVisual {
  const tank = model.tanks[owner];
  const definition = getExperimentalUltimate(ultimateId);
  const shotSeed =
    model.seed + model.round * 1_003 + model.turn * 37 + definition.testSeed;
  const origin = projectileOrigin(tank);
  const trajectory = ballisticPath(model, tank);
  const basePath = samplePath(trajectory);
  const impact =
    basePath[basePath.length - 1] ?? projectileOrigin(tank);
  const result = resolveExperimentalUltimate({
    ultimateId,
    seed: shotSeed,
    origin,
    impact,
    direction: tank.direction,
    terrain: model.terrain,
    tanks: model.tanks.map((candidate) => ({
      id: candidate.id,
      x: candidate.x,
      y: candidate.y,
      health: candidate.health,
      maxHealth: candidate.maxHealth,
    })),
  });
  const duration = Math.min(
    5_000,
    Math.max(2_400, definition.resolutionMs + 320),
  );
  const deploymentAt = clamp(
    definition.anticipationMs / duration,
    0.16,
    0.4,
  );
  const mechanicNodes = result.eventLog.filter(
    (
      event,
    ): event is Extract<
      (typeof result.eventLog)[number],
      { type: "node" }
    > => event.type === "node" && event.mechanic,
  );
  const impactPoints =
    mechanicNodes.length > 0
      ? mechanicNodes.map((event) => event.position)
      : [impact];
  const impactTimes =
    mechanicNodes.length > 0
      ? mechanicNodes.map((event) =>
          clamp(event.atMs / duration, deploymentAt, 0.97),
        )
      : [deploymentAt];

  return {
    weaponId: ultimateId,
    behavior: "experimental",
    owner,
    elapsedMs: 0,
    duration,
    resolvedAt: clamp(definition.resolutionMs / duration, 0.62, 0.99),
    endsAt: 1,
    resolved: false,
    completed: false,
    segments: [
      {
        path: basePath,
        startsAt: 0.03,
        endsAt: deploymentAt,
        style: "experimental",
      },
    ],
    impactPoints,
    impactTimes,
    finalPoint: impact,
    flowPoints: [],
    origin,
    fizzled: false,
    seed: shotSeed,
    mechanicalPaths: {
      digger: [],
      sandhog: [],
      laser: [],
    },
    experimentalResult: result,
  };
}

function applyDamage(
  model: GameModel,
  attackerIndex: 0 | 1,
  tank: PlayerTank,
  rawDamage: number,
  shieldBypass = 0,
  kind: ShieldDamageKind = "blast",
  directHit = false,
): number {
  const damage = Math.max(0, rawDamage);
  const targetIndex = model.tanks[0].id === tank.id ? 0 : 1;
  const result = resolveShieldDamage(
    {
      shieldId: tank.shieldId,
      capacity: tank.shield,
    },
    {
      incomingDamage: damage,
      kind,
      ownerIsTarget: attackerIndex === targetIndex,
      directHit,
      bypassFraction: shieldBypass,
    },
  );
  tank.shield = result.remainingCapacity;
  if (result.event) {
    tank.shieldResponse = result.event.type;
    model.shieldEvents.push({
      player: targetIndex,
      event: result.event,
    });
  }
  const healthDamage = result.healthDamage;
  tank.health = Math.max(0, tank.health - healthDamage);
  const healthPowerLimit = Math.max(
    260,
    Math.round(1_000 * (tank.health / tank.maxHealth)),
  );
  tank.power = Math.min(tank.power, healthPowerLimit);
  const attacker = model.tanks[attackerIndex];
  if (attacker.id !== tank.id) {
    const absorbed =
      result.event?.type === "absorb" || result.event?.type === "break"
        ? result.event.absorbed
        : 0;
    attacker.damageDealt += healthDamage + absorbed * 0.35;
  }
  return healthDamage;
}

function explosionDamage(
  model: GameModel,
  attackerIndex: 0 | 1,
  center: Vector2,
  radius: number,
  peakDamage: number,
  shieldBypass = 0,
  kind: ShieldDamageKind = "blast",
): void {
  for (const tank of model.tanks) {
    const tankCenter = { x: tank.x, y: tank.y - 5 };
    const reach = radius + 18;
    const proximity = distance(center, tankCenter);
    if (proximity > reach) {
      continue;
    }
    applyDamage(
      model,
      attackerIndex,
      tank,
      resolveRadialDamage({
        peakDamage,
        mechanicalRadius: radius,
        distance: proximity,
      }),
      shieldBypass,
      kind,
      proximity <= TANK_HALF_HEIGHT + 5,
    );
  }
}

function settleTanks(
  model: GameModel,
  attackerIndex: 0 | 1,
  allowFallDamage = true,
): void {
  for (const tank of model.tanks) {
    const previousY = tank.y;
    const surface = model.terrain.firstSolidYAtOrBelow(
      tank.x,
      previousY + TANK_HALF_HEIGHT,
    );

    if (surface === null) {
      tank.health = 0;
      tank.y = model.terrain.height + 30;
      continue;
    }

    tank.y = surface - TANK_HALF_HEIGHT;
    const fall = tank.y - previousY;
    if (allowFallDamage && fall > 54) {
      applyDamage(
        model,
        attackerIndex,
        tank,
        Math.min(36, (fall - 42) * 0.42),
        1,
        "fall",
      );
    }
  }
}

function mergeTerrainBounds(
  current: TerrainBounds | null,
  next: TerrainBounds | null,
): TerrainBounds | null {
  if (current === null) {
    return next;
  }
  if (next === null) {
    return current;
  }

  const left = Math.min(current.x, next.x);
  const top = Math.min(current.y, next.y);
  const right = Math.max(
    current.x + current.width,
    next.x + next.width,
  );
  const bottom = Math.max(
    current.y + current.height,
    next.y + next.height,
  );

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function includeTerrainEdit(
  bounds: TerrainBounds | null,
  edit: TerrainEdit,
): TerrainBounds | null {
  return mergeTerrainBounds(bounds, edit.bounds);
}

function queueTerrainDirtyRegion(
  model: GameModel,
  bounds: TerrainBounds | null,
): void {
  if (bounds === null || model.terrainDirtyRegion === "full") {
    return;
  }

  model.terrainDirtyRegion = mergeTerrainBounds(
    model.terrainDirtyRegion,
    bounds,
  );
}

function queueFullTerrainRedraw(model: GameModel): void {
  model.terrainDirtyRegion = "full";
}

function editAlongPath(
  terrain: TerrainGrid,
  path: readonly Vector2[],
  radius: number,
  mode: "carve" | "fill",
  stride = 3,
): TerrainBounds | null {
  let bounds: TerrainBounds | null = null;

  for (let index = 0; index < path.length; index += stride) {
    const point = path[index] as Vector2;
    const edit =
      mode === "carve"
        ? terrain.carveCircle(point.x, point.y, radius)
        : terrain.fillCircle(point.x, point.y, radius, Material.Soil);
    bounds = includeTerrainEdit(bounds, edit);
  }

  return bounds;
}

function editWedge(
  terrain: TerrainGrid,
  start: Vector2,
  end: Vector2,
  width: number,
  mode: "carve" | "fill",
): TerrainBounds | null {
  let bounds: TerrainBounds | null = null;
  const spine = linePath(start, end, 28);
  spine.forEach((point, index) => {
    const progress = index / Math.max(1, spine.length - 1);
    const radius = 3 + progress * width;
    const edit =
      mode === "carve"
        ? terrain.carveCircle(point.x, point.y, radius)
        : terrain.fillCircle(point.x, point.y, radius, Material.Soil);
    bounds = includeTerrainEdit(bounds, edit);
  });

  return bounds;
}

function distanceToSegment(
  point: Vector2,
  start: Vector2,
  end: Vector2,
): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const denominator = deltaX * deltaX + deltaY * deltaY;
  if (denominator <= 0.0001) {
    return distance(point, start);
  }
  const projection = clamp(
    ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
      denominator,
    0,
    1,
  );
  return distance(point, {
    x: start.x + deltaX * projection,
    y: start.y + deltaY * projection,
  });
}

function deflectImpactPoint(
  model: GameModel,
  shot: ShotVisual,
  point: Vector2,
): Vector2 {
  const targetIndex = nextPlayerIndex(shot.owner);
  const target = model.tanks[targetIndex];
  const owner = model.tanks[shot.owner];
  const result = resolveShieldDeflection(
    {
      shieldId: target.shieldId,
      capacity: target.shield,
    },
    {
      impact: point,
      tankCenter: { x: target.x, y: target.y - 5 },
      ownerIsTarget: false,
      incomingDirection: owner.x <= target.x ? 1 : -1,
    },
  );

  if (!result.event) {
    return point;
  }

  const deflectedPoint = {
    x: clamp(result.point.x, 4, model.terrain.width - 4),
    y: clamp(result.point.y, 4, model.terrain.height - 4),
  };
  target.shield = result.remainingCapacity;
  target.shieldResponse = result.event.type;
  model.shieldEvents.push({
    player: targetIndex,
    event: result.event,
  });
  shot.segments.push({
    path: [point, deflectedPoint],
    startsAt: Math.max(0, shot.resolvedAt - 0.08),
    endsAt: Math.min(1, shot.resolvedAt + 0.035),
    style: "energy",
  });
  return deflectedPoint;
}

function applyShieldDeflection(
  model: GameModel,
  shot: ShotVisual,
): void {
  const deflectable =
    shot.behavior === "blast" ||
    shot.behavior === "leap-frog" ||
    shot.behavior === "airburst" ||
    shot.behavior === "riot-bomb" ||
    shot.behavior === "dirt-sphere";
  if (!deflectable) {
    return;
  }

  shot.impactPoints = shot.impactPoints.map((point) =>
    deflectImpactPoint(model, shot, point),
  );
  shot.finalPoint =
    shot.impactPoints[Math.floor(shot.impactPoints.length / 2)] ??
    deflectImpactPoint(model, shot, shot.finalPoint);
}

function resolveWeapon(model: GameModel, shot: ShotVisual): void {
  if (shot.experimentalResult) {
    const previousHealth = new Map(
      model.tanks.map((tank) => [tank.id, tank.health] as const),
    );
    const terrainEvents = shot.experimentalResult.eventLog.filter(
      (
        event,
      ): event is Extract<
        (typeof shot.experimentalResult.eventLog)[number],
        { type: "terrain" }
      > => event.type === "terrain",
    );
    let experimentalDirtyBounds: TerrainBounds | null = null;
    let requiresFullRedraw = terrainEvents.length === 0;
    for (const event of terrainEvents) {
      if (event.changedCells <= 0) {
        continue;
      }
      if (event.bounds === null) {
        requiresFullRedraw = true;
        continue;
      }
      experimentalDirtyBounds = mergeTerrainBounds(
        experimentalDirtyBounds,
        event.bounds,
      );
    }

    model.terrain = shot.experimentalResult.terrain;
    model.terrainRevision += 1;
    if (requiresFullRedraw) {
      queueFullTerrainRedraw(model);
    } else {
      queueTerrainDirtyRegion(model, experimentalDirtyBounds);
    }
    for (const resolvedTank of shot.experimentalResult.tanks) {
      const tank = model.tanks.find(
        (candidate) => candidate.id === resolvedTank.id,
      );
      if (!tank) {
        continue;
      }
      tank.x = resolvedTank.x;
      tank.y = resolvedTank.y;
      tank.health = resolvedTank.health;
      tank.power = Math.min(
        tank.power,
        Math.max(
          260,
          Math.round(1_000 * (tank.health / tank.maxHealth)),
        ),
      );
      if (tank.id !== model.tanks[shot.owner].id) {
        model.tanks[shot.owner].damageDealt += Math.max(
          0,
          (previousHealth.get(tank.id) ?? tank.health) - tank.health,
        );
      }
    }
    return;
  }

  if (isExperimentalUltimateId(shot.weaponId)) {
    return;
  }

  const weapon = getWeapon(shot.weaponId);
  const behavior = DEMO_BEHAVIORS[shot.weaponId];
  const resolution = weapon.demoResolution;
  const effectProfile = getWeaponEffectProfile(shot.weaponId);
  let terrainChanged = false;
  let terrainDirtyBounds: TerrainBounds | null = null;
  const includeEdit = (edit: TerrainEdit): void => {
    terrainDirtyBounds = includeTerrainEdit(terrainDirtyBounds, edit);
  };
  const includeBounds = (bounds: TerrainBounds | null): void => {
    terrainDirtyBounds = mergeTerrainBounds(
      terrainDirtyBounds,
      bounds,
    );
  };

  if (shot.fizzled) {
    return;
  }

  applyShieldDeflection(model, shot);

  if (behavior.kind === "blast") {
    includeEdit(
      model.terrain.carveCircle(
        shot.finalPoint.x,
        shot.finalPoint.y,
        resolution.radius,
      ),
    );
    explosionDamage(
      model,
      shot.owner,
      shot.finalPoint,
      resolution.radius,
      resolution.damage,
    );
    terrainChanged = true;
  }

  if (behavior.kind === "leap-frog") {
    leapFrogImpactPlan(shot.impactPoints).forEach((impact) => {
      const radius = Math.max(8, impact.radius);
      includeEdit(
        model.terrain.carveCircle(
          impact.point.x,
          impact.point.y,
          radius,
        ),
      );
      explosionDamage(
        model,
        shot.owner,
        impact.point,
        radius,
        impact.damage,
      );
    });
    terrainChanged = true;
  }

  if (behavior.kind === "funky") {
    const nodeRadius = effectProfile.mechanicalRadius;
    const nodeDamage =
      resolution.damage / Math.max(2.8, Math.sqrt(shot.impactPoints.length));
    shot.impactPoints.forEach((point, index) => {
      const wobble = 0.82 + (index % 4) * 0.08;
      includeEdit(
        model.terrain.carveCircle(
          point.x,
          point.y,
          nodeRadius * wobble,
        ),
      );
      explosionDamage(
        model,
        shot.owner,
        point,
        nodeRadius * 1.15,
        nodeDamage * wobble,
      );
    });
    terrainChanged = true;
  }

  if (behavior.kind === "airburst") {
    if (
      shot.weaponId !== "mirv" &&
      shot.weaponId !== "deathsHead"
    ) {
      throw new Error(`Unsupported airburst payload: ${shot.weaponId}`);
    }
    airburstImpactPlan(shot.weaponId, shot.impactPoints).forEach((impact) => {
      includeEdit(
        model.terrain.carveCircle(
          impact.point.x,
          impact.point.y,
          impact.radius,
        ),
      );
      explosionDamage(
        model,
        shot.owner,
        impact.point,
        impact.radius + 2,
        impact.damage,
      );
    });
    terrainChanged = shot.impactPoints.length > 0;
  }

  if (behavior.kind === "roller") {
    includeEdit(
      model.terrain.carveCircle(
        shot.finalPoint.x,
        shot.finalPoint.y,
        resolution.radius,
      ),
    );
    explosionDamage(
      model,
      shot.owner,
      shot.finalPoint,
      resolution.radius + 3,
      resolution.damage,
    );
    terrainChanged = true;
  }

  if (behavior.kind === "napalm") {
    shot.flowPoints.forEach((point, index) => {
      if (index % 2 === 0) {
        includeEdit(
          model.terrain.carveCircle(
            point.x,
            point.y + 2,
            behavior.tier >= 4 ? 8 : 5,
          ),
        );
      }
    });

    for (const tank of model.tanks) {
      const closest = shot.flowPoints.reduce(
        (best, point) =>
          Math.min(best, Math.hypot(tank.x - point.x, tank.y - point.y)),
        Number.POSITIVE_INFINITY,
      );
      const reach = effectProfile.mechanicalRadius;
      if (closest < reach) {
        applyDamage(
          model,
          shot.owner,
          tank,
          resolution.damage * (1 - closest / (reach + 18)),
          0,
          "napalm",
        );
      }
    }
    terrainChanged = true;
  }

  if (behavior.kind === "riot-wedge") {
    const tank = model.tanks[shot.owner];
    includeBounds(
      editWedge(
        model.terrain,
        { x: tank.x, y: tank.y - 5 },
        shot.finalPoint,
        behavior.tier === 1 ? 13 : 23,
        "carve",
      ),
    );
    terrainChanged = true;
  }

  if (behavior.kind === "riot-bomb") {
    includeEdit(
      model.terrain.carveCircle(
        shot.finalPoint.x,
        shot.finalPoint.y,
        resolution.radius,
      ),
    );
    terrainChanged = true;
  }

  if (behavior.kind === "digger") {
    includeBounds(
      editAlongPath(
        model.terrain,
        shot.mechanicalPaths.digger,
        3 + behavior.tier * 1.6,
        "carve",
        2,
      ),
    );
    const endpointRadius = Math.max(
      7 + behavior.tier * 4,
      resolution.radius,
    );
    includeEdit(
      model.terrain.carveCircle(
        shot.finalPoint.x,
        shot.finalPoint.y,
        endpointRadius,
      ),
    );
    explosionDamage(
      model,
      shot.owner,
      shot.finalPoint,
      endpointRadius + 2,
      resolution.damage,
    );
    terrainChanged = true;
  }

  if (behavior.kind === "sandhog") {
    const undergroundPaths = shot.mechanicalPaths.sandhog;
    undergroundPaths.forEach((path, index) => {
      includeBounds(
        editAlongPath(
          model.terrain,
          path,
          2.5 + behavior.tier,
          "carve",
          2,
        ),
      );
      const endpoint =
        path[path.length - 1] ?? shot.finalPoint;
      const radius = Math.max(8, resolution.radius);
      includeEdit(
        model.terrain.carveCircle(endpoint.x, endpoint.y, radius),
      );
      explosionDamage(
        model,
        shot.owner,
        endpoint,
        radius + 2,
        resolution.damage /
          Math.max(1.4, Math.sqrt(undergroundPaths.length)) *
          (0.9 + (index % 3) * 0.06),
        0.82,
        "underground",
      );
    });
    terrainChanged = true;
  }

  if (behavior.kind === "dirt-sphere") {
    includeEdit(
      model.terrain.fillCircle(
        shot.finalPoint.x,
        shot.finalPoint.y - 10,
        resolution.radius,
        Material.Soil,
      ),
    );
    terrainChanged = true;
  }

  if (behavior.kind === "liquid-dirt") {
    shot.flowPoints.forEach((point, index) => {
      const depth = 4 + (index % 3) * 2;
      includeEdit(
        model.terrain.fillCircle(
          point.x,
          point.y - depth * 0.4,
          depth,
          Material.Soil,
        ),
      );
    });
    includeEdit(
      model.terrain.settle({
        maxPasses: 5,
        maxMoves: 8_000,
        movableMaterials: [Material.Soil],
      }),
    );
    terrainChanged = true;
  }

  if (behavior.kind === "dirt-wedge") {
    const tank = model.tanks[shot.owner];
    includeBounds(
      editWedge(
        model.terrain,
        { x: tank.x, y: tank.y - 8 },
        shot.finalPoint,
        18,
        "fill",
      ),
    );
    terrainChanged = true;
  }

  if (behavior.kind === "settle") {
    includeEdit(
      model.terrain.settle({
        maxPasses: 12,
        maxMoves: 22_000,
        movableMaterials: [Material.Soil],
      }),
    );
    terrainChanged = true;
  }

  if (behavior.kind === "plasma") {
    const ownerTank = model.tanks[shot.owner];
    const radius = resolution.radius;
    model.tanks.forEach((tank) => {
      if (
        tank.id !== ownerTank.id &&
        distance(
          { x: tank.x, y: tank.y - 5 },
          { x: ownerTank.x, y: ownerTank.y - 5 },
        ) <=
          radius + 18
      ) {
        const proximity = distance(
          { x: tank.x, y: tank.y - 5 },
          { x: ownerTank.x, y: ownerTank.y - 5 },
        );
        applyDamage(
          model,
          shot.owner,
          tank,
          resolution.damage * (1 - proximity / (radius + 32)),
          0,
          "plasma",
        );
      }
    });
  }

  if (behavior.kind === "laser") {
    const laserPath = shot.mechanicalPaths.laser;
    if (laserPath.length > 0) {
      includeBounds(
        editAlongPath(
          model.terrain,
          laserPath,
          2.2,
          "carve",
          1,
        ),
      );
      const start = laserPath[0] ?? shot.origin;
      const end =
        laserPath[laserPath.length - 1] ?? shot.finalPoint;
      model.tanks.forEach((tank) => {
        if (
          tank.id !== model.tanks[shot.owner].id &&
          distanceToSegment({ x: tank.x, y: tank.y - 5 }, start, end) <=
            effectProfile.mechanicalRadius
        ) {
          applyDamage(
            model,
            shot.owner,
            tank,
            resolution.damage,
            1,
            "laser",
            true,
          );
        }
      });
      terrainChanged = true;
    }
  }

  if (terrainChanged) {
    model.terrainRevision += 1;
    queueTerrainDirtyRegion(model, terrainDirtyBounds);
  }

  settleTanks(
    model,
    shot.owner,
    behavior.kind !== "dirt-sphere" &&
      behavior.kind !== "liquid-dirt" &&
      behavior.kind !== "dirt-wedge",
  );
}

function chooseAvailableWeapon(
  model: GameModel,
  player: 0 | 1,
): WeaponId {
  return availableSelectedWeapon(model.tanks[player], model.mode);
}

function shieldEventText(model: GameModel): string {
  return model.shieldEvents
    .slice(-2)
    .map(({ player, event }) => {
      const tank = model.tanks[player];
      const shield = getShield(event.shieldId);
      switch (event.type) {
        case "absorb":
          return `${tank.name}: ${shield.shortName} поглощает ${Math.ceil(
            event.absorbed,
          )}, заряд ${Math.ceil(event.remainingCapacity)}.`;
        case "break":
          return `${tank.name}: ${shield.shortName} разрушен; в корпус проходит ${Math.ceil(
            event.healthDamage,
          )}.`;
        case "deflect":
          return `${tank.name}: ${shield.shortName} отклоняет impact, заряд ${Math.ceil(
            event.remainingCapacity,
          )}.`;
        case "laser-immunity":
          return `${tank.name}: ${shield.shortName} блокирует Laser.`;
        case "bypass":
          return event.reason === "self-direct"
            ? `${tank.name}: прямое собственное попадание проходит под щитом.`
            : `${tank.name}: ${shield.shortName} не останавливает это воздействие.`;
      }
    })
    .join(" ");
}

function withShieldEvents(model: GameModel, message: string): string {
  const shieldMessage = shieldEventText(model);
  return shieldMessage ? `${message} ${shieldMessage}` : message;
}

function shotOutcomeText(model: GameModel, shot: ShotVisual): string {
  if (isExperimentalUltimateId(shot.weaponId)) {
    const ultimate = getExperimentalUltimate(shot.weaponId);
    const player = model.tanks[shot.owner];
    const opponent = model.tanks[nextPlayerIndex(shot.owner)];
    if (opponent.health <= 0 && player.health <= 0) {
      return `${ultimate.name}: двойное уничтожение. Раунд завершён вничью.`;
    }
    if (opponent.health <= 0) {
      return `${ultimate.name}: ${player.name} выводит соперника из строя.`;
    }
    if (player.health <= 0) {
      return `${ultimate.name}: ${player.name} попадает под собственный эффект.`;
    }
    return `${ultimate.name}: детерминированные mechanics разрешены; декоративный aftermath не блокирует следующий ход.`;
  }

  const weapon = getWeapon(shot.weaponId);
  if (shot.fizzled) {
    return withShieldEvents(
      model,
      `${weapon.name}: carrier коснулся преграды до апогея и погас без взрыва.`,
    );
  }
  if (DEMO_BEHAVIORS[shot.weaponId].kind === "tracer") {
    return withShieldEvents(
      model,
      `${weapon.name}: траектория отмечена, прямой урон — 0.`,
    );
  }

  const player = model.tanks[shot.owner];
  const opponent = model.tanks[nextPlayerIndex(shot.owner)];

  if (opponent.health <= 0 && player.health <= 0) {
    return withShieldEvents(
      model,
      "Двойное уничтожение. Раунд завершён вничью.",
    );
  }
  if (opponent.health <= 0) {
    return withShieldEvents(
      model,
      `${player.name} выводит соперника из строя.`,
    );
  }
  if (player.health <= 0) {
    return withShieldEvents(
      model,
      `${player.name} попадает под собственный удар.`,
    );
  }

  return withShieldEvents(
    model,
    "Рельеф стабилен. Ход переходит сопернику.",
  );
}

function roundScore(tank: PlayerTank): number {
  return tank.health + tank.shield * 0.45;
}

function completeRound(model: GameModel): void {
  const firstScore = roundScore(model.tanks[0]);
  const secondScore = roundScore(model.tanks[1]);
  const draw = Math.abs(firstScore - secondScore) < 0.5;
  const winner = draw ? null : firstScore > secondScore ? 0 : 1;

  model.roundWinner = winner;
  model.lastRoundWasDraw = draw;
  if (winner !== null) {
    model.tanks[winner].wins += 1;
  }

  if (shouldOpenInterroundShop(model.mode)) {
    model.tanks.forEach((tank, index) => {
      tank.credits +=
        7_000 +
        Math.round(tank.damageDealt * 55) +
        (winner === index ? 2_500 : 0);
      tank.bankAtRoundStart = tank.credits;
      tank.lastInterest = 0;
    });
  } else {
    model.tanks.forEach((tank) => {
      tank.bankAtRoundStart = 0;
      tank.lastInterest = 0;
    });
  }

  model.phase = "roundEnd";
  model.message = draw
    ? `Раунд ${model.round}: ничья по состоянию машин.`
    : `${model.tanks[winner as 0 | 1].name} выигрывает раунд ${model.round}.`;
}

function prepareNextRound(model: GameModel): void {
  const applyRoundInterest = (tank: PlayerTank): number => {
    const eligibleBank = tank.credits;
    const earned = calculateInterest(eligibleBank);
    const verifiedEarned = applyInterest(eligibleBank) - eligibleBank;
    tank.lastInterest = Math.min(earned, verifiedEarned);
    tank.credits += tank.lastInterest;
    return tank.lastInterest;
  };
  const interestEarned: [number, number] = shouldOpenInterroundShop(
    model.mode,
  )
    ? [
        applyRoundInterest(model.tanks[0]),
        applyRoundInterest(model.tanks[1]),
      ]
    : [0, 0];

  model.round += 1;
  model.turn = 0;
  model.activePlayer = model.round % 2 === 0 ? 1 : 0;
  const battlefield = generateBattlefield(
    model.seed + (model.round - 1) * 7_919,
  );
  model.terrain = battlefield.terrain;
  model.terrainRevision += 1;
  queueFullTerrainRedraw(model);
  model.wind = nextWind(model.seed, model.round);
  model.roundWinner = null;
  model.lastRoundWasDraw = false;

  model.tanks.forEach((tank, index) => {
    const spawn =
      index === 0 ? battlefield.spawns[0] : battlefield.spawns[1];
    tank.x = spawn.x;
    tank.y = spawn.y;
    tank.maxHealth = 100 + tank.bonusHealth;
    tank.health = tank.maxHealth;
    tank.maxShield = shieldCapacity(tank.shieldId, tank.reserveShield);
    tank.shield = tank.maxShield;
    tank.shieldResponse = null;
    tank.bonusHealth = 0;
    tank.reserveShield = 0;
    tank.damageDealt = 0;
    tank.direction = index === 0 ? 1 : -1;
  });

  model.phase = "aiming";
  model.message = isInfiniteArsenalMode(model.mode)
    ? `Раунд ${model.round}. Infinite Arsenal: магазин пропущен, canonical 33 и Experimental 10 доступны. Ветер ${Math.abs(model.wind)}.`
    : `Раунд ${model.round}. Проценты 5%: +₡${formatCredits(interestEarned[0])} / ` +
      `+₡${formatCredits(interestEarned[1])}. Ветер ${Math.abs(model.wind)}.`;
}

function renderTerrain(
  terrain: TerrainGrid,
  revision: number,
  dirtyRegion: TerrainBounds | "full" | null,
  cacheRef: { current: TerrainCache | null },
): HTMLCanvasElement {
  if (cacheRef.current?.revision === revision) {
    return cacheRef.current.canvas;
  }

  const cached = cacheRef.current;
  const canvas = cached?.canvas ?? document.createElement("canvas");
  const dimensionsChanged =
    canvas.width !== terrain.width || canvas.height !== terrain.height;
  if (dimensionsChanged) {
    canvas.width = terrain.width;
    canvas.height = terrain.height;
  }
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    return canvas;
  }

  const requestedRegion =
    cached === null || dimensionsChanged || dirtyRegion === "full"
      ? {
          x: 0,
          y: 0,
          width: terrain.width,
          height: terrain.height,
        }
      : dirtyRegion;
  const left =
    requestedRegion === null
      ? 0
      : clamp(Math.floor(requestedRegion.x), 0, terrain.width);
  const top =
    requestedRegion === null
      ? 0
      : clamp(Math.floor(requestedRegion.y), 0, terrain.height);
  const right =
    requestedRegion === null
      ? 0
      : clamp(
          Math.ceil(requestedRegion.x + requestedRegion.width),
          left,
          terrain.width,
        );
  const bottom =
    requestedRegion === null
      ? 0
      : clamp(
          Math.ceil(requestedRegion.y + requestedRegion.height),
          top,
          terrain.height,
        );
  const region = {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };

  if (region.width > 0 && region.height > 0) {
    context.clearRect(
      region.x,
      region.y,
      region.width,
      region.height,
    );
    const image = context.createImageData(region.width, region.height);
    const pixels = image.data;

    for (let localY = 0; localY < region.height; localY += 1) {
      const y = region.y + localY;
      for (let localX = 0; localX < region.width; localX += 1) {
        const x = region.x + localX;
        const material = terrain.cells[
          y * terrain.width + x
        ] as Material;
        if (material === Material.Empty) {
          continue;
        }

        const offset = (localY * region.width + localX) * 4;
        const noise = ((x * 17 + y * 31) % 19) - 9;
        if (material === Material.Rock) {
          pixels[offset] = 40 + noise;
          pixels[offset + 1] = 48 + noise;
          pixels[offset + 2] = 50 + noise;
        } else {
          pixels[offset] = 72 + noise;
          pixels[offset + 1] = 74 + Math.floor(noise * 0.6);
          pixels[offset + 2] = 54 + Math.floor(noise * 0.35);
        }
        pixels[offset + 3] = 255;
      }
    }

    context.putImageData(image, region.x, region.y);

    context.save();
    context.globalCompositeOperation = "source-atop";
    const soilShade = context.createLinearGradient(0, 230, 0, terrain.height);
    soilShade.addColorStop(0, "rgba(216, 255, 69, 0.32)");
    soilShade.addColorStop(0.06, "rgba(138, 147, 74, 0.10)");
    soilShade.addColorStop(0.5, "rgba(8, 10, 11, 0.14)");
    soilShade.addColorStop(1, "rgba(0, 0, 0, 0.52)");
    context.fillStyle = soilShade;
    context.fillRect(
      region.x,
      region.y,
      region.width,
      region.height,
    );
    context.restore();
  }

  const minimap = cached?.minimap ?? document.createElement("canvas");
  const minimapDimensionsChanged =
    minimap.width !== MINIMAP_BOUNDS.width ||
    minimap.height !== MINIMAP_BOUNDS.height;
  if (minimapDimensionsChanged) {
    minimap.width = MINIMAP_BOUNDS.width;
    minimap.height = MINIMAP_BOUNDS.height;
  }
  const minimapContext = minimap.getContext("2d");
  if (minimapContext) {
    const fullMinimapRedraw =
      cached === null ||
      dimensionsChanged ||
      minimapDimensionsChanged ||
      dirtyRegion === "full";
    if (fullMinimapRedraw) {
      minimapContext.clearRect(0, 0, minimap.width, minimap.height);
      minimapContext.drawImage(
        canvas,
        0,
        0,
        terrain.width,
        terrain.height,
        0,
        0,
        minimap.width,
        minimap.height,
      );
    } else if (region.width > 0 && region.height > 0) {
      const scaleX = minimap.width / terrain.width;
      const scaleY = minimap.height / terrain.height;
      const destinationLeft = clamp(
        Math.floor(region.x * scaleX) - 1,
        0,
        minimap.width,
      );
      const destinationTop = clamp(
        Math.floor(region.y * scaleY) - 1,
        0,
        minimap.height,
      );
      const destinationRight = clamp(
        Math.ceil((region.x + region.width) * scaleX) + 1,
        destinationLeft,
        minimap.width,
      );
      const destinationBottom = clamp(
        Math.ceil((region.y + region.height) * scaleY) + 1,
        destinationTop,
        minimap.height,
      );
      const destinationWidth = destinationRight - destinationLeft;
      const destinationHeight = destinationBottom - destinationTop;
      const sourceX = destinationLeft / scaleX;
      const sourceY = destinationTop / scaleY;
      const sourceWidth = destinationWidth / scaleX;
      const sourceHeight = destinationHeight / scaleY;

      minimapContext.clearRect(
        destinationLeft,
        destinationTop,
        destinationWidth,
        destinationHeight,
      );
      minimapContext.drawImage(
        canvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        destinationLeft,
        destinationTop,
        destinationWidth,
        destinationHeight,
      );
    }
  }

  cacheRef.current = { canvas, minimap, revision };
  return canvas;
}

function drawBackdrop(
  context: CanvasRenderingContext2D,
  now: number,
  camera: CameraState,
): void {
  const sky = context.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
  sky.addColorStop(0, "#07090a");
  sky.addColorStop(0.58, "#101719");
  sky.addColorStop(1, "#1b1d18");
  context.fillStyle = sky;
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  context.save();
  context.globalAlpha = 0.25;
  for (let index = 0; index < 56; index += 1) {
    const x =
      ((index * 173 + 41 - camera.center.x * 0.14) %
        (VIEWPORT_WIDTH + 140)) -
      70;
    const y =
      ((index * 71 + 27 - camera.center.y * 0.025) % 250) - 6;
    const pulse = 0.45 + Math.sin(now * 0.0007 + index) * 0.2;
    context.fillStyle = index % 7 === 0 ? "#68e5ef" : "#f1f3e9";
    context.globalAlpha = pulse;
    context.fillRect(x, y, index % 5 === 0 ? 2 : 1, 1);
  }
  context.restore();

  const glowCenterX =
    ((760 - camera.center.x * 0.08) % (VIEWPORT_WIDTH + 260)) - 80;
  const glow = context.createRadialGradient(
    glowCenterX,
    92,
    2,
    glowCenterX,
    92,
    105,
  );
  glow.addColorStop(0, "rgba(216,255,69,0.20)");
  glow.addColorStop(0.22, "rgba(216,255,69,0.08)");
  glow.addColorStop(1, "rgba(216,255,69,0)");
  context.fillStyle = glow;
  context.fillRect(glowCenterX - 110, 0, 220, 205);

  context.strokeStyle = "rgba(104,229,239,0.045)";
  context.lineWidth = 1;
  const gridOffset = -(camera.center.x * 0.08) % 48;
  for (
    let x = gridOffset - 48;
    x <= VIEWPORT_WIDTH + 48;
    x += 48
  ) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, VIEWPORT_HEIGHT);
    context.stroke();
  }
}

function drawMinimap(
  context: CanvasRenderingContext2D,
  terrainOverview: HTMLCanvasElement,
  model: GameModel,
  camera: CameraState,
): void {
  const { x, y, width, height } = MINIMAP_BOUNDS;
  const scaleX = width / model.terrain.width;
  const scaleY = height / model.terrain.height;
  const visibleWidth = VIEWPORT_WIDTH / camera.zoom;
  const visibleHeight = VIEWPORT_HEIGHT / camera.zoom;

  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.42)";
  context.shadowBlur = 14;
  context.fillStyle = "rgba(5, 13, 18, 0.84)";
  context.beginPath();
  context.roundRect(x - 5, y - 5, width + 10, height + 10, 9);
  context.fill();
  context.shadowBlur = 0;

  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, 5);
  context.clip();
  context.fillStyle = "#11191b";
  context.fillRect(x, y, width, height);
  context.globalAlpha = 0.86;
  context.drawImage(terrainOverview, x, y, width, height);
  context.globalAlpha = 1;

  for (const tank of model.tanks) {
    context.fillStyle = tank.color;
    context.beginPath();
    context.arc(
      x + tank.x * scaleX,
      y + tank.y * scaleY,
      3.2,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  context.strokeStyle = "rgba(241, 243, 233, 0.95)";
  context.lineWidth = 1.5;
  context.strokeRect(
    x + (camera.center.x - visibleWidth / 2) * scaleX,
    y + (camera.center.y - visibleHeight / 2) * scaleY,
    visibleWidth * scaleX,
    visibleHeight * scaleY,
  );
  context.restore();

  context.strokeStyle = "rgba(104, 229, 239, 0.5)";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(x - 5, y - 5, width + 10, height + 10, 9);
  context.stroke();
  context.restore();
}

function cameraShakeOffset(
  shot: ShotVisual | null,
  progress: number,
  model: GameModel,
): Vector2 {
  if (
    !shot ||
    model.paused ||
    model.reducedMotion ||
    model.effectLevel === "reduced"
  ) {
    return { x: 0, y: 0 };
  }

  if (isExperimentalUltimateId(shot.weaponId)) {
    const definition = getExperimentalUltimate(shot.weaponId);
    const startsAt = clamp(
      definition.anticipationMs / shot.duration,
      0.12,
      0.5,
    );
    const endsAt = Math.min(shot.endsAt, startsAt + 0.36);
    if (progress < startsAt || progress >= endsAt) {
      return { x: 0, y: 0 };
    }
    const local = clamp(
      (progress - startsAt) / Math.max(0.01, endsAt - startsAt),
      0,
      1,
    );
    const qualityScale = model.effectLevel === "balanced" ? 0.52 : 1;
    const amplitude =
      clamp(
        1.4 + Math.sqrt(definition.footprint.spectacleRadius) * 0.42,
        2,
        9,
      ) *
      qualityScale *
      Math.sin(local * Math.PI);
    const phase = shot.elapsedMs * 0.058 + shot.seed * 0.17;
    return {
      x: Math.sin(phase) * amplitude,
      y: Math.cos(phase * 1.41) * amplitude * 0.48,
    };
  }

  const behavior = DEMO_BEHAVIORS[shot.weaponId];
  const profile = getWeaponEffectProfile(shot.weaponId);
  const startsAt =
    behavior.kind === "funky"
      ? (shot.impactTimes[0] ?? shot.resolvedAt)
      : shot.resolvedAt;
  const endsAt = Math.min(
    shot.endsAt,
    startsAt + (behavior.kind === "funky" ? 0.42 : 0.18),
  );
  if (progress < startsAt || progress >= endsAt) {
    return { x: 0, y: 0 };
  }

  const local = clamp(
    (progress - startsAt) / Math.max(0.01, endsAt - startsAt),
    0,
    1,
  );
  const qualityScale = model.effectLevel === "balanced" ? 0.55 : 1;
  const signatureScale =
    profile.signature === "nuclear"
      ? 1.28
      : profile.signature === "cascade"
        ? 1.08
        : profile.signature === "trail"
          ? 0.38
          : profile.signature === "growth"
            ? 0.72
            : 0.9;
  const baseAmplitude = clamp(
    (1.2 + Math.sqrt(profile.spectacleRadius) * 0.48) * signatureScale,
    1.2,
    12,
  );
  const burst =
    behavior.kind === "funky"
      ? 0.5 + Math.abs(Math.sin(local * Math.PI * 5)) * 0.5
      : 1;
  const amplitude =
    baseAmplitude *
    qualityScale *
    Math.sin(Math.PI * local) *
    (1 - local * 0.28) *
    burst;
  const phase = shot.elapsedMs * 0.085 + shot.seed * 0.31;

  return {
    x: Math.sin(phase) * amplitude,
    y: Math.cos(phase * 1.73) * amplitude * 0.62,
  };
}

function drawShieldField(
  context: CanvasRenderingContext2D,
  tank: PlayerTank,
  now: number,
): void {
  const shield = getShield(tank.shieldId);
  const shape = shield.demoProfile.visualShape;
  if (
    shape === "none" ||
    (tank.shield <= 0 && tank.shieldResponse === null)
  ) {
    return;
  }

  const chargeRatio = clamp(
    tank.shield / Math.max(1, tank.maxShield),
    0,
    1,
  );
  const pulse = 1 + Math.sin(now * 0.003 + tank.x) * 0.025;
  const width = 28 * pulse;
  const height = 23 * pulse;

  context.save();
  context.translate(tank.x, tank.y - 7);
  context.strokeStyle = shield.accent;
  context.fillStyle = shield.accent;
  context.globalAlpha = 0.28 + chargeRatio * 0.34;
  context.lineWidth = 2;

  if (shape === "solid-shell" || shape === "hybrid-field") {
    context.beginPath();
    context.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
    context.stroke();
  }

  if (shape === "magnetic-arcs" || shape === "hybrid-field") {
    context.lineWidth = shape === "hybrid-field" ? 1.5 : 2.3;
    [-1, 1].forEach((side) => {
      context.beginPath();
      context.arc(side * 7, 1, 22, Math.PI * 1.12, Math.PI * 1.88);
      context.stroke();
    });
    [-10, 10].forEach((x) => {
      context.beginPath();
      context.moveTo(x - 4, -25);
      context.lineTo(x, -31);
      context.lineTo(x + 4, -25);
      context.stroke();
    });
  }

  if (shape === "vector-field") {
    [-9, 0, 9].forEach((offset) => {
      context.beginPath();
      context.moveTo(-26 + offset * 0.22, 16 + offset);
      context.quadraticCurveTo(8, -2 + offset, 25, -20 + offset * 0.3);
      context.stroke();
    });
    context.beginPath();
    context.moveTo(18, -25);
    context.lineTo(27, -21);
    context.lineTo(24, -12);
    context.stroke();
  }

  if (shape === "layered-shell") {
    [0, 5, 10].forEach((layer) => {
      context.globalAlpha = 0.2 + chargeRatio * (0.34 - layer * 0.012);
      context.beginPath();
      context.ellipse(
        0,
        0,
        width + layer,
        height + layer * 0.68,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    });
  }

  if (shape === "hybrid-field") {
    context.beginPath();
    context.moveTo(-12, -25);
    context.lineTo(-6, -34);
    context.lineTo(0, -27);
    context.lineTo(6, -34);
    context.lineTo(12, -25);
    context.stroke();
  }

  context.globalAlpha = 0.82;
  context.lineWidth = 2.5;
  switch (tank.shieldResponse) {
    case "absorb":
      context.globalAlpha = 0.11;
      context.beginPath();
      context.ellipse(0, 0, width + 4, height + 4, 0, 0, Math.PI * 2);
      context.fill();
      break;
    case "deflect":
      context.beginPath();
      context.moveTo(-5, 0);
      context.lineTo(18, -20);
      context.lineTo(13, -20);
      context.moveTo(18, -20);
      context.lineTo(18, -15);
      context.stroke();
      break;
    case "break":
      context.beginPath();
      context.moveTo(-15, -15);
      context.lineTo(15, 15);
      context.moveTo(15, -15);
      context.lineTo(-15, 15);
      context.stroke();
      break;
    case "bypass":
      context.setLineDash([4, 3]);
      context.beginPath();
      context.moveTo(-36, 12);
      context.lineTo(36, -12);
      context.stroke();
      context.setLineDash([]);
      break;
    case "laser-immunity":
      context.beginPath();
      context.moveTo(-38, 0);
      context.lineTo(-12, 0);
      context.moveTo(12, 0);
      context.lineTo(38, 0);
      context.stroke();
      context.fillRect(-3, -13, 6, 26);
      break;
    case null:
      break;
  }
  context.restore();
}

function drawTank(
  context: CanvasRenderingContext2D,
  tank: PlayerTank,
  isActive: boolean,
  now: number,
): void {
  if (tank.health <= 0) {
    context.save();
    context.translate(tank.x, tank.y);
    context.rotate(-0.18);
    context.fillStyle = "#2b2d2b";
    context.fillRect(-17, -5, 34, 10);
    context.fillStyle = "rgba(255,102,88,0.32)";
    context.beginPath();
    context.arc(0, -12, 5 + Math.sin(now * 0.004) * 1.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  const radians = (tank.angleDegrees * Math.PI) / 180;
  const barrelEnd = {
    x: barrelEndX(tank.x, tank.angleDegrees, tank.direction, 25),
    y: tank.y - 8 - Math.sin(radians) * 25,
  };

  context.save();
  drawShieldField(context, tank, now);

  if (isActive) {
    context.fillStyle = `${tank.color}1d`;
    context.beginPath();
    context.arc(tank.x, tank.y - 4, 29, 0, Math.PI * 2);
    context.fill();
  }

  context.lineCap = "round";
  context.strokeStyle = "#07090a";
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(tank.x, tank.y - 8);
  context.lineTo(barrelEnd.x, barrelEnd.y);
  context.stroke();
  context.strokeStyle = tank.color;
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "#07090a";
  context.beginPath();
  context.roundRect(tank.x - 19, tank.y - 3, 38, 13, 4);
  context.fill();
  context.strokeStyle = tank.color;
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = tank.color;
  context.beginPath();
  context.arc(tank.x, tank.y - 8, 8, Math.PI, 0);
  context.fill();

  context.fillStyle = "#dce6db";
  context.font = "700 9px ui-monospace, monospace";
  context.textAlign = "center";
  context.fillText(`${Math.ceil(tank.health)}`, tank.x, tank.y + 25);

  if (isActive) {
    context.fillStyle = tank.color;
    context.beginPath();
    context.moveTo(tank.x, tank.y - 45);
    context.lineTo(tank.x - 5, tank.y - 53);
    context.lineTo(tank.x + 5, tank.y - 53);
    context.closePath();
    context.fill();
  }
  context.restore();
}

function segmentColor(
  style: SegmentStyle,
  weaponId: PlayableWeaponId,
): string {
  if (isExperimentalUltimateId(weaponId)) {
    return getExperimentalUltimate(weaponId).accent;
  }
  const weapon = getWeapon(weaponId);
  switch (style) {
    case "ballistic":
    case "cluster-parent":
    case "funky":
    case "roller":
    case "digger":
    case "napalm":
    case "dirt":
    case "riot":
    case "sandhog":
    case "energy":
    case "laser":
    case "settle":
      return weapon.accent;
    case "experimental":
      return weapon.accent;
    case "cluster-child":
      return weapon.secondaryAccent;
    case "tracer":
      return "#fff6a2";
    case "smoke-tracer":
      return weapon.secondaryAccent;
  }
}

const PROJECTILE_PATH_SCRATCH = { x: 0, y: 0 };

function drawProjectile(
  context: CanvasRenderingContext2D,
  segment: FlightSegment,
  weaponId: PlayableWeaponId,
  progress: number,
  reduced: boolean,
  now: number,
): void {
  const local = clamp(
    (progress - segment.startsAt) / (segment.endsAt - segment.startsAt),
    0,
    1,
  );
  const color =
    segment.style === "funky"
      ? `hsl(${Math.round((now * 0.035 + local * 240) % 360)} 94% 68%)`
      : segmentColor(segment.style, weaponId);
  const trailStart = Math.max(
    0,
    local -
      (segment.style === "smoke-tracer"
        ? reduced
          ? 0.18
          : 0.5
        : reduced
          ? 0.08
          : 0.2),
  );

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.shadowColor = color;
  context.shadowBlur = reduced ? 4 : 13;
  context.globalAlpha = 0.64;
  context.lineWidth =
    segment.style === "napalm" ||
    segment.style === "roller" ||
    segment.style === "smoke-tracer"
      ? 4
      : segment.style === "laser"
        ? 5
        : 2;
  if (segment.style === "smoke-tracer") {
    context.setLineDash([2, 7]);
    context.globalAlpha = reduced ? 0.38 : 0.62;
  }
  context.beginPath();
  const trailSamples = segment.style === "laser" ? 36 : 12;
  for (let sample = 0; sample <= trailSamples; sample += 1) {
    const trailProgress = lerp(
      segment.style === "laser" ? 0 : trailStart,
      local,
      sample / trailSamples,
    );
    if (
      !pointAlongPathInto(
        segment.path,
        trailProgress,
        PROJECTILE_PATH_SCRATCH,
      )
    ) {
      PROJECTILE_PATH_SCRATCH.x = 0;
      PROJECTILE_PATH_SCRATCH.y = 0;
    }
    if (sample === 0) {
      context.moveTo(
        PROJECTILE_PATH_SCRATCH.x,
        PROJECTILE_PATH_SCRATCH.y,
      );
    } else {
      context.lineTo(
        PROJECTILE_PATH_SCRATCH.x,
        PROJECTILE_PATH_SCRATCH.y,
      );
    }
  }
  context.stroke();
  context.setLineDash([]);

  context.globalAlpha = 1;
  context.fillStyle = color;
  if (!pointAlongPathInto(segment.path, local, PROJECTILE_PATH_SCRATCH)) {
    PROJECTILE_PATH_SCRATCH.x = 0;
    PROJECTILE_PATH_SCRATCH.y = 0;
  }
  const point = PROJECTILE_PATH_SCRATCH;

  if (segment.style === "roller") {
    context.translate(point.x, point.y);
    context.rotate(now * 0.012);
    context.beginPath();
    context.arc(0, 0, 7, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#07090a";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-6, 0);
    context.lineTo(6, 0);
    context.moveTo(0, -6);
    context.lineTo(0, 6);
    context.stroke();
  } else if (
    (segment.style === "digger" || segment.style === "sandhog") &&
    segment.startsAt > 0.35
  ) {
    context.translate(point.x, point.y);
    context.rotate(now * 0.018);
    context.beginPath();
    for (let spike = 0; spike < 6; spike += 1) {
      const angle = (Math.PI * 2 * spike) / 6;
      const radius = spike % 2 === 0 ? 9 : 5;
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.closePath();
    context.fill();
  } else if (segment.style === "cluster-parent") {
    context.translate(point.x, point.y);
    context.rotate(now * 0.005);
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(6, 4);
    context.lineTo(0, 7);
    context.lineTo(-6, 4);
    context.closePath();
    context.fill();
  } else if (
    segment.style === "laser" ||
    segment.style === "energy" ||
    segment.style === "settle"
  ) {
    // These families are communicated by geometry in drawShot.
  } else if (segment.style === "riot") {
    context.beginPath();
    context.moveTo(point.x, point.y - 5);
    context.lineTo(point.x + 8, point.y);
    context.lineTo(point.x, point.y + 5);
    context.closePath();
    context.fill();
  } else {
    let radius = 4;
    if (segment.style === "napalm" || segment.style === "dirt") {
      radius = 6;
    } else if (segment.style === "funky") {
      radius = 5;
    } else if (segment.style === "cluster-child") {
      radius =
        weaponId === "deathsHead" ? 6 : weaponId === "mirv" ? 5 : 4;
    }
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawRadialImpactEnvelope(
  context: CanvasRenderingContext2D,
  center: Vector2,
  profile: WeaponEffectProfile,
  weapon: (typeof WEAPONS)[number],
  local: number,
  effectLevel: EffectLevel,
): void {
  const reveal = 1 - Math.pow(1 - local, 3);
  const fade = Math.max(0, 1 - local);
  const mechanicalRadius = profile.mechanicalRadius * reveal;
  const spectacleRadius =
    profile.readableRadius +
    (profile.spectacleRadius - profile.readableRadius) * reveal;
  const reduced = effectLevel === "reduced";
  const balanced = effectLevel === "balanced";

  context.save();
  context.translate(center.x, center.y);

  // Solid ring and cardinal ticks are the exact mechanical/readable boundary.
  context.strokeStyle = weapon.secondaryAccent;
  context.lineWidth = reduced ? 1.8 : 2.6;
  context.globalAlpha = Math.min(0.92, 0.34 + fade * 0.7);
  context.beginPath();
  context.arc(0, 0, mechanicalRadius, 0, Math.PI * 2);
  context.stroke();
  const tickCount = profile.signature === "nuclear" ? 12 : 8;
  for (let tick = 0; tick < tickCount; tick += 1) {
    const angle = (Math.PI * 2 * tick) / tickCount;
    const inner = Math.max(0, mechanicalRadius - (reduced ? 3 : 6));
    const outer = mechanicalRadius + (reduced ? 3 : 7);
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.stroke();
  }

  // Dashed echo rings are deliberately non-mechanical spectacle.
  const echoCount = reduced
    ? Math.min(1, profile.shockwaveCount)
    : balanced
      ? Math.min(2, profile.shockwaveCount)
      : profile.shockwaveCount;
  context.strokeStyle = weapon.accent;
  context.setLineDash(reduced ? [4, 8] : [7, 11]);
  context.lineWidth = reduced ? 1.2 : 2;
  for (let echo = 0; echo < echoCount; echo += 1) {
    const ringProgress = (echo + 1) / Math.max(1, echoCount);
    const radius =
      profile.readableRadius +
      (spectacleRadius - profile.readableRadius) * ringProgress;
    context.globalAlpha =
      fade * (reduced ? 0.26 : 0.42) * (1 - echo * 0.13);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.setLineDash([]);

  if (profile.signature === "nuclear") {
    const light = context.createRadialGradient(
      0,
      0,
      mechanicalRadius * 0.18,
      0,
      0,
      Math.max(1, spectacleRadius),
    );
    light.addColorStop(0, `${weapon.secondaryAccent}7f`);
    light.addColorStop(0.34, `${weapon.accent}36`);
    light.addColorStop(1, `${weapon.accent}00`);
    context.fillStyle = light;
    context.globalAlpha = reduced ? 0.28 : balanced ? 0.46 : 0.64;
    context.beginPath();
    context.arc(0, 0, spectacleRadius, 0, Math.PI * 2);
    context.fill();

    const plumeHeight = spectacleRadius * (reduced ? 0.45 : 0.72);
    context.strokeStyle = weapon.secondaryAccent;
    context.globalAlpha = fade * (reduced ? 0.34 : 0.66);
    context.lineWidth = reduced ? 2 : 5;
    context.beginPath();
    context.moveTo(0, -mechanicalRadius * 0.35);
    context.bezierCurveTo(
      -spectacleRadius * 0.18,
      -plumeHeight * 0.45,
      spectacleRadius * 0.2,
      -plumeHeight * 0.72,
      0,
      -plumeHeight,
    );
    context.stroke();
  } else if (!reduced && profile.signature !== "growth") {
    const rayCount = balanced ? 6 : 10;
    context.strokeStyle = weapon.accent;
    context.globalAlpha = fade * 0.46;
    context.lineWidth = 1.4;
    for (let ray = 0; ray < rayCount; ray += 1) {
      const angle = (Math.PI * 2 * ray) / rayCount + local * 0.22;
      const inner = profile.readableRadius * (0.78 + local * 0.16);
      const outer =
        inner +
        (profile.spectacleRadius - profile.readableRadius) *
          (0.38 + (ray % 3) * 0.16);
      context.beginPath();
      context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      context.stroke();
    }
  }

  context.restore();
}

function drawImpactEnvelopes(
  context: CanvasRenderingContext2D,
  shot: ShotVisual,
  progress: number,
  effectLevel: EffectLevel,
): void {
  if (isExperimentalUltimateId(shot.weaponId)) {
    return;
  }
  const profile = getWeaponEffectProfile(shot.weaponId);
  if (
    profile.shape !== "radial" &&
    profile.shape !== "multi-radial" &&
    profile.shape !== "subterranean" &&
    profile.shape !== "terrain-fill"
  ) {
    return;
  }

  const weapon = getWeapon(shot.weaponId);
  const sourcePoints =
    shot.impactPoints.length > 0 ? shot.impactPoints : [shot.finalPoint];
  const points = sourcePoints
    .map((point, sourceIndex) => ({ point, sourceIndex }))
    .filter(
      ({ sourceIndex }) => sourcePoints.length <= 9 || sourceIndex % 2 === 0,
    );
  points.forEach(({ point, sourceIndex }) => {
    const startsAt =
      shot.impactTimes[
        Math.min(sourceIndex, Math.max(0, shot.impactTimes.length - 1))
      ] ?? shot.resolvedAt;
    const local = clamp(
      (progress - startsAt) /
        Math.max(0.01, shot.endsAt - startsAt),
      0,
      1,
    );
    if (local <= 0 || local >= 1) {
      return;
    }
    const impactRadius =
      shot.weaponId === "leapFrog"
        ? (leapFrogImpactProfiles()[sourceIndex]?.radius ??
          profile.mechanicalRadius)
        : shot.weaponId === "mirv" || shot.weaponId === "deathsHead"
          ? airburstPayloadProfile(shot.weaponId).warheadRadius
          : profile.mechanicalRadius;
    const impactScale =
      profile.mechanicalRadius > 0
        ? impactRadius / profile.mechanicalRadius
        : 1;
    const impactProfile =
      impactRadius === profile.mechanicalRadius
        ? profile
        : {
            ...profile,
            mechanicalRadius: impactRadius,
            readableRadius: impactRadius,
            spectacleRadius: Math.max(
              impactRadius,
              profile.spectacleRadius * impactScale,
            ),
          };
    drawRadialImpactEnvelope(
      context,
      point,
      impactProfile,
      weapon,
      local,
      effectLevel,
    );
  });
}

const experimentalPrimitiveCache = new Map<string, HTMLCanvasElement>();

function experimentalPrimitive(
  accent: string,
  secondaryAccent: string,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  const key = `${accent}:${secondaryAccent}`;
  const cached = experimentalPrimitiveCache.get(key);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 72;
  canvas.height = 72;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const glow = context.createRadialGradient(36, 36, 2, 36, 36, 34);
  glow.addColorStop(0, `${secondaryAccent}d9`);
  glow.addColorStop(0.22, `${accent}b8`);
  glow.addColorStop(1, `${accent}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, 72, 72);
  context.strokeStyle = secondaryAccent;
  context.lineWidth = 2;
  context.beginPath();
  for (let point = 0; point < 8; point += 1) {
    const angle = (Math.PI * 2 * point) / 8 - Math.PI / 2;
    const radius = point % 2 === 0 ? 19 : 8;
    const x = 36 + Math.cos(angle) * radius;
    const y = 36 + Math.sin(angle) * radius;
    if (point === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.stroke();
  experimentalPrimitiveCache.set(key, canvas);
  return canvas;
}

function strokePolygon(
  context: CanvasRenderingContext2D,
  points: readonly Vector2[],
  close = true,
): void {
  const first = points[0];
  if (!first) {
    return;
  }
  context.beginPath();
  context.moveTo(first.x, first.y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  if (close) {
    context.closePath();
  }
  context.stroke();
}

function drawExperimentalShot(
  context: CanvasRenderingContext2D,
  shot: ShotVisual,
  progress: number,
  model: GameModel,
  now: number,
): void {
  if (!isExperimentalUltimateId(shot.weaponId) || !shot.experimentalResult) {
    return;
  }
  const definition = getExperimentalUltimate(shot.weaponId);
  const elapsedMs = progress * shot.duration;
  const anticipation = clamp(
    elapsedMs / Math.max(1, definition.anticipationMs),
    0,
    1,
  );
  const deployment = clamp(
    (elapsedMs - definition.anticipationMs) /
      Math.max(1, definition.resolutionMs - definition.anticipationMs),
    0,
    1,
  );
  const aftermath = clamp(
    (elapsedMs - definition.resolutionMs) /
      Math.max(1, shot.duration - definition.resolutionMs),
    0,
    1,
  );
  const quality =
    definition.quality[model.effectLevel];
  const density = clamp(quality.drawOperations / 260, 0.32, 1);
  const nodes = shot.experimentalResult.eventLog.filter(
    (
      event,
    ): event is Extract<
      (typeof shot.experimentalResult.eventLog)[number],
      { type: "node" }
    > => event.type === "node" && event.atMs <= elapsedMs,
  );
  const center = shot.finalPoint;
  const mechanicalRadius = definition.footprint.mechanicalRadius;
  const pulse = model.reducedMotion
    ? 1
    : 0.96 + Math.sin(now * 0.005 + shot.seed) * 0.04;

  for (const segment of shot.segments) {
    if (progress >= segment.startsAt && progress <= segment.endsAt) {
      drawProjectile(
        context,
        segment,
        shot.weaponId,
        progress,
        model.reducedMotion,
        now,
      );
    }
  }

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = definition.accent;
  context.fillStyle = `${definition.accent}1f`;
  context.lineWidth = model.effectLevel === "reduced" ? 1.5 : 2.4;
  context.globalAlpha = Math.min(0.78, 0.2 + anticipation * 0.58);

  // Beat 1: a low-contrast targeting mark, intentionally below flash limits.
  context.beginPath();
  context.arc(center.x, center.y, 8 + anticipation * 12, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(center.x - 26, center.y);
  context.lineTo(center.x + 26, center.y);
  context.moveTo(center.x, center.y - 26);
  context.lineTo(center.x, center.y + 26);
  context.stroke();

  // Beat 2/3: each strategy owns its geometry, motion and reveal rhythm.
  context.globalAlpha = 0.74 * (1 - aftermath * 0.58);
  context.strokeStyle = definition.accent;
  context.fillStyle = `${definition.secondaryAccent}20`;
  context.shadowColor = definition.accent;
  context.shadowBlur =
    model.effectLevel === "reduced" || model.reducedMotion ? 0 : 12;

  switch (definition.strategy) {
    case "top-down-column": {
      const shaftWidth = 9 + deployment * 16;
      const top = lerp(center.y, 0, deployment);
      const beam = context.createLinearGradient(center.x, top, center.x, center.y);
      beam.addColorStop(0, `${definition.accent}00`);
      beam.addColorStop(0.55, `${definition.accent}70`);
      beam.addColorStop(1, `${definition.secondaryAccent}d0`);
      context.fillStyle = beam;
      context.fillRect(center.x - shaftWidth / 2, top, shaftWidth, center.y - top);
      context.strokeStyle = definition.secondaryAccent;
      context.beginPath();
      context.arc(center.x, center.y, mechanicalRadius * deployment, 0, Math.PI * 2);
      context.stroke();
      break;
    }
    case "gravity-pulses": {
      const rings = Math.max(1, Math.min(3, nodes.filter((node) => node.role === "pulse").length));
      for (let ring = 0; ring < rings; ring += 1) {
        const radius =
          mechanicalRadius * pulse * (1 - ring * 0.19) * (0.45 + deployment * 0.55);
        context.beginPath();
        context.ellipse(center.x, center.y, radius, radius * 0.38, ring * 0.28, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      context.arc(center.x, center.y, 8 + deployment * 15, 0, Math.PI * 2);
      context.fill();
      break;
    }
    case "reverse-bounce-chain": {
      const bounceNodes = nodes.filter((node) => node.role === "bounce");
      strokePolygon(context, bounceNodes.map((node) => node.position), false);
      [...bounceNodes].reverse().forEach((node, index) => {
        const radius = 5 + ((elapsedMs * 0.018 + index * 5) % 16);
        context.save();
        context.translate(node.position.x, node.position.y);
        context.rotate(Math.PI / 4 + index * 0.22);
        context.strokeRect(-radius, -radius, radius * 2, radius * 2);
        context.restore();
      });
      break;
    }
    case "trajectory-echoes": {
      const echoNodes = nodes.filter((node) => node.role === "echo").reverse();
      strokePolygon(context, [shot.origin, ...echoNodes.map((node) => node.position)], false);
      echoNodes.forEach((node, index) => {
        context.beginPath();
        context.arc(node.position.x, node.position.y, 4 + index * 1.8, -Math.PI / 2, Math.PI * (1.1 + deployment));
        context.stroke();
      });
      break;
    }
    case "portal-volley": {
      const entrance = nodes.find((node) => node.role === "portal-in")?.position;
      const exit = nodes.find((node) => node.role === "portal-out")?.position;
      if (entrance) {
        context.beginPath();
        context.ellipse(entrance.x, entrance.y, 18, 30 * pulse, 0, 0, Math.PI * 2);
        context.stroke();
      }
      if (exit) {
        context.save();
        context.translate(exit.x, exit.y);
        context.rotate(Math.PI / 4);
        context.strokeRect(-20, -20, 40, 40);
        context.restore();
        if (entrance) {
          context.setLineDash([8, 9]);
          strokePolygon(context, [entrance, exit], false);
          context.setLineDash([]);
        }
      }
      nodes.filter((node) => node.role === "mini-impact").forEach((node) => {
        context.beginPath();
        context.arc(node.position.x, node.position.y, 7, 0, Math.PI * 2);
        context.stroke();
      });
      break;
    }
    case "rock-transmutation": {
      const tips = nodes.filter((node) => node.role === "crystal-tip");
      const radius = mechanicalRadius * deployment;
      const star = Array.from({ length: 12 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 12 - Math.PI / 2;
        const pointRadius = index % 2 === 0 ? radius : radius * 0.34;
        return {
          x: center.x + Math.cos(angle) * pointRadius,
          y: center.y + Math.sin(angle) * pointRadius,
        };
      });
      strokePolygon(context, star);
      tips.forEach((node) => strokePolygon(context, [center, node.position], false));
      break;
    }
    case "volcanic-construction": {
      const halfWidth = mechanicalRadius * 0.72 * deployment;
      context.beginPath();
      context.moveTo(center.x - halfWidth, center.y);
      context.lineTo(center.x, center.y - mechanicalRadius * 0.72 * deployment);
      context.lineTo(center.x + halfWidth, center.y);
      context.closePath();
      context.fill();
      context.stroke();
      nodes.filter((node) => node.role === "ejecta").forEach((node, index) => {
        const controlY = Math.min(center.y, node.position.y) - 58 - index * 4;
        context.beginPath();
        context.moveTo(center.x, center.y - mechanicalRadius * 0.45);
        context.quadraticCurveTo(
          (center.x + node.position.x) / 2,
          controlY,
          node.position.x,
          node.position.y,
        );
        context.stroke();
      });
      break;
    }
    case "branching-faults": {
      nodes.filter((node) => node.role === "fault").forEach((node, index) => {
        const midpoint = {
          x: lerp(center.x, node.position.x, 0.52),
          y: lerp(center.y, node.position.y, 0.52) + (index - 2) * 11,
        };
        strokePolygon(context, [center, midpoint, node.position], false);
        context.beginPath();
        context.ellipse(
          node.position.x,
          surfaceForTank(model.terrain, node.position.x) - 2,
          12 + index * 3,
          4,
          0,
          0,
          Math.PI * 2,
        );
        context.stroke();
      });
      break;
    }
    case "triangular-pulses": {
      const anchors = nodes
        .filter((node) => node.role === "anchor")
        .map((node) => node.position);
      strokePolygon(context, anchors);
      anchors.forEach((anchor, index) => {
        const curtain = 34 + index * 13 + deployment * 42;
        context.beginPath();
        context.moveTo(anchor.x, anchor.y);
        context.lineTo(anchor.x, anchor.y - curtain);
        context.stroke();
      });
      break;
    }
    case "annular-wave": {
      const inner = 48 * deployment;
      const outer = mechanicalRadius * deployment;
      context.beginPath();
      context.arc(center.x, center.y, inner, 0, Math.PI * 2);
      context.stroke();
      context.lineWidth *= 1.7;
      context.beginPath();
      context.arc(center.x, center.y, outer, 0, Math.PI * 2);
      context.stroke();
      context.lineWidth /= 1.7;
      if (model.effectLevel !== "reduced") {
        context.setLineDash([10, 12]);
        context.beginPath();
        context.arc(
          center.x,
          center.y,
          definition.footprint.spectacleRadius * deployment,
          0,
          Math.PI * 2,
        );
        context.stroke();
        context.setLineDash([]);
      }
      break;
    }
  }

  // Beat 4: pooled particles carry the long decorative tail after mechanics.
  const primitive = experimentalPrimitive(
    definition.accent,
    definition.secondaryAccent,
  );
  if (primitive && model.effectLevel !== "reduced") {
    const spriteCount = Math.max(1, Math.round(4 * density));
    for (let sprite = 0; sprite < spriteCount; sprite += 1) {
      const angle = (Math.PI * 2 * sprite) / spriteCount + now * 0.00015;
      const radius =
        definition.footprint.spectacleRadius *
        (0.18 + deployment * 0.52) *
        pulse;
      const size = 34 + (sprite % 2) * 12;
      context.globalAlpha = 0.28 * (1 - aftermath);
      context.drawImage(
        primitive,
        center.x + Math.cos(angle) * radius - size / 2,
        center.y + Math.sin(angle) * radius - size / 2,
        size,
        size,
      );
    }
  }
  context.restore();
}

function drawShot(
  context: CanvasRenderingContext2D,
  shot: ShotVisual,
  progress: number,
  model: GameModel,
  now: number,
): void {
  if (isExperimentalUltimateId(shot.weaponId)) {
    drawExperimentalShot(context, shot, progress, model, now);
    return;
  }

  const weapon = getWeapon(shot.weaponId);
  const behavior = DEMO_BEHAVIORS[shot.weaponId];
  const density =
    model.effectLevel === "full"
      ? 1
      : model.effectLevel === "balanced"
        ? 0.68
        : 0.38;

  for (const segment of shot.segments) {
    if (progress >= segment.startsAt && progress <= segment.endsAt) {
      drawProjectile(
        context,
        segment,
        shot.weaponId,
        progress,
        model.reducedMotion,
        now,
      );
    }
  }

  if (
    behavior.kind === "airburst" &&
    !shot.fizzled &&
    progress > 0.39 &&
    progress < 0.5
  ) {
    const splitPoint =
      shot.segments[0]?.path[
        (shot.segments[0]?.path.length ?? 1) - 1
      ] ?? shot.finalPoint;
    const expansion = (progress - 0.39) / 0.11;
    context.save();
    context.strokeStyle = weapon.secondaryAccent;
    context.lineWidth = 3;
    context.globalAlpha = 1 - expansion;
    context.beginPath();
    context.arc(splitPoint.x, splitPoint.y, 9 + expansion * 34, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  if (
    (behavior.kind === "digger" || behavior.kind === "sandhog") &&
    progress > 0.42 &&
    progress < 0.8
  ) {
    const local = (progress - 0.42) / 0.38;
    const underground =
      behavior.kind === "digger"
        ? shot.mechanicalPaths.digger
        : (shot.mechanicalPaths.sandhog[0] ?? []);
    if (!pointAlongPathInto(underground, local, PROJECTILE_PATH_SCRATCH)) {
      PROJECTILE_PATH_SCRATCH.x = shot.finalPoint.x;
      PROJECTILE_PATH_SCRATCH.y = shot.finalPoint.y;
    }
    const point = PROJECTILE_PATH_SCRATCH;
    context.save();
    context.strokeStyle = weapon.accent;
    context.globalAlpha = 0.3;
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(
      point.x,
      surfaceForTank(model.terrain, point.x) - 2,
      20 + behavior.tier * 4,
      5 + behavior.tier,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
  }

  if (behavior.kind === "napalm" && progress > 0.54) {
    const spread = clamp((progress - 0.54) / 0.24, 0, 1);
    const visible = Math.ceil(shot.flowPoints.length * spread);
    const stride = model.effectLevel === "reduced" ? 3 : 1;
    context.save();
    context.globalCompositeOperation = "lighter";
    for (let index = 0; index < visible; index += stride) {
      const point = shot.flowPoints[index] as Vector2;
      const flicker = Math.sin(now * 0.014 + index * 1.7);
      const height =
        8 +
        behavior.tier * 2 +
        (index % 4) * 3 +
        flicker * (model.reducedMotion ? 1 : 3);
      const flame = context.createLinearGradient(
        point.x,
        point.y,
        point.x,
        point.y - height,
      );
      flame.addColorStop(0, "rgba(255,61,38,0.95)");
      flame.addColorStop(0.55, "rgba(255,194,71,0.82)");
      flame.addColorStop(1, "rgba(255,247,170,0)");
      context.fillStyle = flame;
      context.beginPath();
      context.moveTo(point.x - 5, point.y + 2);
      context.quadraticCurveTo(
        point.x - 2,
        point.y - height * 0.52,
        point.x + flicker * 2,
        point.y - height,
      );
      context.quadraticCurveTo(
        point.x + 4,
        point.y - height * 0.4,
        point.x + 6,
        point.y + 2,
      );
      context.closePath();
      context.fill();
    }
    context.restore();
  }

  if (behavior.kind === "liquid-dirt" && progress > 0.52) {
    const spread = clamp((progress - 0.52) / 0.3, 0, 1);
    const visible = Math.ceil(shot.flowPoints.length * spread);
    context.save();
    context.strokeStyle = weapon.accent;
    context.fillStyle = `${weapon.accent}66`;
    context.lineWidth = 5;
    for (
      let index = 0;
      index < visible;
      index += model.effectLevel === "reduced" ? 3 : 1
    ) {
      const point = shot.flowPoints[index] as Vector2;
      context.beginPath();
      context.ellipse(point.x, point.y, 7, 3, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  if (
    (behavior.kind === "dirt-sphere" || behavior.kind === "dirt-wedge") &&
    progress > shot.resolvedAt
  ) {
    const bloom = clamp(
      (progress - shot.resolvedAt) / (shot.endsAt - shot.resolvedAt),
      0,
      1,
    );
    context.save();
    context.translate(shot.finalPoint.x, shot.finalPoint.y - 10);
    context.strokeStyle = weapon.accent;
    context.globalAlpha = 0.68 * (1 - bloom * 0.45);
    context.fillStyle = `${weapon.accent}22`;
    context.shadowColor = weapon.accent;
    context.shadowBlur = model.reducedMotion ? 4 : 18;
    const rayCount = Math.max(4, Math.round(10 * density));
    for (let ray = 0; ray < rayCount; ray += 1) {
      const angle = (Math.PI * 2 * ray) / rayCount;
      const length =
        10 +
        bloom *
          (behavior.kind === "dirt-wedge" ? 18 : 25 + behavior.tier * 8);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(
        Math.cos(angle - 0.12) * length,
        Math.sin(angle - 0.12) * length,
      );
      context.lineTo(
        Math.cos(angle + 0.12) * length,
        Math.sin(angle + 0.12) * length,
      );
      context.closePath();
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  if (
    (behavior.kind === "riot-wedge" || behavior.kind === "dirt-wedge") &&
    progress > 0.1 &&
    progress < shot.endsAt
  ) {
    const owner = model.tanks[shot.owner];
    context.save();
    context.fillStyle = `${weapon.accent}22`;
    context.strokeStyle = weapon.accent;
    context.globalAlpha = 0.7;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(owner.x, owner.y - 7);
    context.lineTo(shot.finalPoint.x, shot.finalPoint.y - 14);
    context.lineTo(shot.finalPoint.x, shot.finalPoint.y + 14);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }

  if (behavior.kind === "settle" && progress > 0.12) {
    const fallProgress = clamp((progress - 0.12) / 0.7, 0, 1);
    const lineCount = Math.max(8, Math.round(26 * density));
    context.save();
    context.strokeStyle = weapon.accent;
    context.lineWidth = 1.5;
    context.globalAlpha = 0.35 * (1 - fallProgress * 0.45);
    for (let index = 0; index < lineCount; index += 1) {
      const x = ((index * 79 + shot.seed) % (model.terrain.width - 30)) + 15;
      const startY = ((index * 31) % 130) - 30 + fallProgress * 260;
      context.beginPath();
      context.moveTo(x, startY);
      context.lineTo(x, startY + 22 + (index % 4) * 8);
      context.stroke();
    }
    context.restore();
  }

  if (behavior.kind === "plasma" && progress > 0.14) {
    const pulse = clamp((progress - 0.14) / 0.54, 0, 1);
    const radius = weapon.demoResolution.radius * pulse;
    context.save();
    context.strokeStyle = weapon.accent;
    context.fillStyle = `${weapon.secondaryAccent}18`;
    context.lineWidth = model.effectLevel === "reduced" ? 2 : 4;
    context.globalAlpha = 0.82 * (1 - pulse * 0.45);
    context.beginPath();
    context.arc(shot.finalPoint.x, shot.finalPoint.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (model.effectLevel !== "reduced") {
      context.setLineDash([8, 7]);
      context.beginPath();
      context.arc(
        shot.finalPoint.x,
        shot.finalPoint.y,
        radius * 0.68,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    context.restore();
  }

  if (behavior.kind === "laser" && progress > 0.18) {
    const laserPath = shot.mechanicalPaths.laser;
    if (laserPath.length > 0) {
      const start = laserPath[0] ?? shot.origin;
      const end = laserPath[laserPath.length - 1] ?? shot.finalPoint;
      context.save();
      const beam = context.createLinearGradient(
        start.x,
        start.y,
        end.x,
        end.y,
      );
      beam.addColorStop(0, "#ffffff");
      beam.addColorStop(0.32, weapon.accent);
      beam.addColorStop(1, weapon.secondaryAccent);
      context.strokeStyle = beam;
      context.shadowColor = weapon.accent;
      context.shadowBlur = model.effectLevel === "reduced" ? 5 : 16;
      context.lineWidth = model.effectLevel === "reduced" ? 2 : 4;
      context.globalAlpha =
        progress < 0.7 ? 0.86 : clamp(1 - (progress - 0.7) / 0.22, 0, 1);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      context.restore();
    }
  }

  if (behavior.kind === "funky") {
    const rainbow = [
      "#ff4f81",
      "#ffb84d",
      "#f5ef65",
      "#5bf28d",
      "#5ce7ff",
      "#8e8bff",
      "#e66cff",
    ] as const;
    context.save();
    context.globalCompositeOperation = "lighter";
    shot.impactPoints.forEach((point, index) => {
      const startsAt = shot.impactTimes[index] ?? 0.5;
      const local = clamp((progress - startsAt) / 0.19, 0, 1);
      if (local <= 0 || local >= 1) {
        return;
      }
      context.strokeStyle = rainbow[index % rainbow.length] as string;
      context.lineWidth = 3 - local * 1.8;
      context.globalAlpha = (1 - local) * 0.78;
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        5 + local * (18 + (index % 3) * 5),
        0,
        Math.PI * 2,
      );
      context.stroke();
      if (
        model.effectLevel !== "reduced" &&
        index % 2 === 0
      ) {
        context.fillStyle = rainbow[(index + 2) % rainbow.length] as string;
        context.fillRect(
          point.x + Math.cos(index) * local * 24 - 2,
          point.y + Math.sin(index * 1.7) * local * 20 - 2,
          4,
          4,
        );
      }
    });
    context.restore();
  }

  if (!shot.fizzled) {
    drawImpactEnvelopes(context, shot, progress, model.effectLevel);
  }

  if (shot.fizzled && progress > shot.resolvedAt) {
    const local = clamp(
      (progress - shot.resolvedAt) /
        Math.max(0.01, shot.endsAt - shot.resolvedAt),
      0,
      1,
    );
    context.save();
    context.strokeStyle = "#aab1b5";
    context.globalAlpha = 1 - local;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(shot.finalPoint.x, shot.finalPoint.y, 7 + local * 13, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(shot.finalPoint.x - 6, shot.finalPoint.y - 6);
    context.lineTo(shot.finalPoint.x + 6, shot.finalPoint.y + 6);
    context.moveTo(shot.finalPoint.x + 6, shot.finalPoint.y - 6);
    context.lineTo(shot.finalPoint.x - 6, shot.finalPoint.y + 6);
    context.stroke();
    context.restore();
  }

}

function playerStyle(color: string): CSSProperties {
  return { "--player-color": color } as CSSProperties;
}

function weaponStyle(color: string): CSSProperties {
  return { "--weapon-color": color } as CSSProperties;
}

function shieldStyle(color: string): CSSProperties {
  return { "--shield-color": color } as CSSProperties;
}

function audioPanForX(x: number, terrainWidth = WORLD_WIDTH): number {
  return clamp((x / terrainWidth) * 2 - 1, -1, 1);
}

function audioMaterialAtImpact(
  game: GameModel,
  shot: ShotVisual,
): AudioMaterial {
  if (shot.behavior === "napalm") {
    return "liquid-fire";
  }
  const material = game.terrain.get(shot.finalPoint.x, shot.finalPoint.y);
  if (material === Material.Rock) {
    return "rock";
  }
  if (material === Material.Soil) {
    return "soil";
  }
  return "air";
}

function audioMusicState(game: GameModel): MusicState {
  switch (game.phase) {
    case "intro":
      return "intro";
    case "firing":
      return "flight";
    case "shop":
      return "shop";
    case "roundEnd":
      return "round-result";
    case "matchEnd":
      return "match-end";
    case "aiming":
      return "aiming";
  }
}

function causesTerrainCollapse(shot: ShotVisual): boolean {
  return (
    shot.behavior === "settle" ||
    shot.behavior === "digger" ||
    shot.behavior === "sandhog" ||
    shot.behavior === "experimental"
  );
}

export default function ScorchedGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainCacheRef = useRef<TerrainCache | null>(null);
  const gameRef = useRef<GameModel>(null!);
  if (gameRef.current === null) {
    gameRef.current = createGame();
  }
  const cameraRef = useRef<CameraState>(null!);
  if (cameraRef.current === null) {
    cameraRef.current = createCamera(
      cameraTargetForTank(
        gameRef.current.tanks[gameRef.current.activePlayer],
      ),
      CAMERA_VIEWPORT,
      cameraWorldForTerrain(gameRef.current.terrain),
    );
  }
  const cameraModeRef = useRef<"auto" | "manual">("auto");
  const pointerGestureRef = useRef<CameraGesture>({
    pointers: new Map(),
    pinchDistance: null,
    pinchMidpoint: null,
    minimapPointerId: null,
  });
  const shotRef = useRef<ShotVisual | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const particlePoolRef = useRef<Particle[]>([]);
  const audioRef = useRef<AudioDirector | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const weaponDialogRef = useRef<HTMLDialogElement | null>(null);
  const weaponTriggerRef = useRef<HTMLButtonElement | null>(null);
  const weaponCloseOutcomeRef = useRef<SelectorCloseOutcome | null>(null);
  const shieldDialogRef = useRef<HTMLDialogElement | null>(null);
  const shieldTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shieldCloseOutcomeRef = useRef<SelectorCloseOutcome | null>(null);
  const weaponOptionRefs = useRef<
    Partial<Record<PlayableWeaponId, HTMLButtonElement | null>>
  >({});
  const shieldOptionRefs = useRef<
    Partial<Record<ShieldId, HTMLButtonElement | null>>
  >({});
  const [, setRevision] = useState(0);
  const [arsenalFilter, setArsenalFilter] =
    useState<WeaponSelectorFilterId>("all");
  const [weaponSelectorFilter, setWeaponSelectorFilter] =
    useState<WeaponSelectorFilterId>("all");
  const [weaponSelectorOpen, setWeaponSelectorOpen] = useState(false);
  const [shieldSelectorOpen, setShieldSelectorOpen] = useState(false);

  const model = gameRef.current;
  const infiniteArsenal = isInfiniteArsenalMode(model.mode);
  const activeTank = model.tanks[model.activePlayer];
  const selectedWeapon = chooseAvailableWeapon(model, model.activePlayer);
  const selectedWeaponDefinition = getWeapon(selectedWeapon);
  const selectedExperimentalDefinition =
    infiniteArsenal && activeTank.selectedExperimental
      ? getExperimentalUltimate(activeTank.selectedExperimental)
      : null;
  const selectedPlayableId: PlayableWeaponId =
    selectedExperimentalDefinition?.id ?? selectedWeapon;
  const selectedPlayable = selectedExperimentalDefinition
    ? {
        name: selectedExperimentalDefinition.name,
        icon: selectedExperimentalDefinition.icon,
        accent: selectedExperimentalDefinition.accent,
        role: "Experimental Ultimate",
        stock: "∞ showcase",
        count: "Experimental 10",
      }
    : {
        name: selectedWeaponDefinition.name,
        icon: selectedWeaponDefinition.icon,
        accent: selectedWeaponDefinition.accent,
        role: weaponCatalogSubtitle(selectedWeaponDefinition),
        stock: infiniteArsenal
          ? "∞ showcase"
          : selectedWeaponDefinition.ammo.kind === "unlimited"
            ? "∞ базовый"
            : `× ${weaponAmmo(activeTank, selectedWeapon)}`,
        count: "Арсенал 33",
      };
  const activeShieldDefinition = getShield(activeTank.shieldId);
  const controlsLocked = model.phase !== "aiming" || model.paused;
  const selectorWeapons = weaponsForSelectorFilter(weaponSelectorFilter);
  const selectorExperimental =
    infiniteArsenal &&
    (weaponSelectorFilter === "all" ||
      weaponSelectorFilter === "experimental")
      ? EXPERIMENTAL_ULTIMATES
      : [];
  const selectorPlayableIds: readonly PlayableWeaponId[] = [
    ...selectorWeapons.map((weapon) => weapon.id),
    ...selectorExperimental.map((ultimate) => ultimate.id),
  ];

  const refresh = useCallback(() => {
    setRevision((revision) => revision + 1);
  }, []);

  const recenterCamera = useCallback(() => {
    const game = gameRef.current;
    cameraModeRef.current = "auto";
    cameraRef.current = createCamera(
      cameraTargetForTank(game.tanks[game.activePlayer]),
      CAMERA_VIEWPORT,
      cameraWorldForTerrain(game.terrain),
      cameraRef.current.zoom,
    );
  }, []);

  const panCameraPage = useCallback((direction: -1 | 1) => {
    const game = gameRef.current;
    cameraModeRef.current = "manual";
    cameraRef.current = panCameraByScreenDelta(
      cameraRef.current,
      {
        x: -direction * VIEWPORT_WIDTH * 0.68,
        y: 0,
      },
      CAMERA_VIEWPORT,
      cameraWorldForTerrain(game.terrain),
    );
  }, []);

  const changeCameraZoom = useCallback((factor: number) => {
    const game = gameRef.current;
    cameraModeRef.current = "manual";
    cameraRef.current = zoomCameraAtScreenPoint(
      cameraRef.current,
      cameraRef.current.zoom * factor,
      {
        x: VIEWPORT_WIDTH / 2,
        y: VIEWPORT_HEIGHT / 2,
      },
      CAMERA_VIEWPORT,
      cameraWorldForTerrain(game.terrain),
    );
  }, []);

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const canvas = event.currentTarget;
      const point = canvasPointFromClient(
        canvas,
        event.clientX,
        event.clientY,
      );
      const gesture = pointerGestureRef.current;

      canvas.setPointerCapture(event.pointerId);
      cameraModeRef.current = "manual";

      if (pointInsideMinimap(point)) {
        gesture.minimapPointerId = event.pointerId;
        const terrain = gameRef.current.terrain;
        cameraRef.current = clampCamera(
          {
            center: minimapPointToWorld(point, terrain),
            zoom: cameraRef.current.zoom,
          },
          CAMERA_VIEWPORT,
          cameraWorldForTerrain(terrain),
        );
        return;
      }

      gesture.pointers.set(event.pointerId, point);
      const points = [...gesture.pointers.values()];
      if (points.length >= 2) {
        gesture.pinchDistance = pointerDistance(
          points[0] as Vector2,
          points[1] as Vector2,
        );
        gesture.pinchMidpoint = pointerMidpoint(
          points[0] as Vector2,
          points[1] as Vector2,
        );
      }
    },
    [],
  );

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const gesture = pointerGestureRef.current;
      const point = canvasPointFromClient(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      const terrain = gameRef.current.terrain;
      const world = cameraWorldForTerrain(terrain);

      if (gesture.minimapPointerId === event.pointerId) {
        cameraRef.current = clampCamera(
          {
            center: minimapPointToWorld(point, terrain),
            zoom: cameraRef.current.zoom,
          },
          CAMERA_VIEWPORT,
          world,
        );
        return;
      }

      const previous = gesture.pointers.get(event.pointerId);
      if (!previous) {
        return;
      }
      gesture.pointers.set(event.pointerId, point);
      const points = [...gesture.pointers.values()];

      if (points.length === 1) {
        gesture.pinchDistance = null;
        gesture.pinchMidpoint = null;
        cameraRef.current = panCameraByScreenDelta(
          cameraRef.current,
          {
            x: point.x - previous.x,
            y: point.y - previous.y,
          },
          CAMERA_VIEWPORT,
          world,
        );
        return;
      }

      const first = points[0] as Vector2;
      const second = points[1] as Vector2;
      const distance = Math.max(1, pointerDistance(first, second));
      const midpoint = pointerMidpoint(first, second);
      const previousDistance = gesture.pinchDistance;
      const previousMidpoint = gesture.pinchMidpoint;

      if (previousDistance !== null && previousMidpoint !== null) {
        const panned = panCameraByScreenDelta(
          cameraRef.current,
          {
            x: midpoint.x - previousMidpoint.x,
            y: midpoint.y - previousMidpoint.y,
          },
          CAMERA_VIEWPORT,
          world,
        );
        cameraRef.current = zoomCameraAtScreenPoint(
          panned,
          panned.zoom * (distance / previousDistance),
          midpoint,
          CAMERA_VIEWPORT,
          world,
        );
      }

      gesture.pinchDistance = distance;
      gesture.pinchMidpoint = midpoint;
    },
    [],
  );

  const releaseCanvasPointer = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const gesture = pointerGestureRef.current;
      gesture.pointers.delete(event.pointerId);
      if (gesture.minimapPointerId === event.pointerId) {
        gesture.minimapPointerId = null;
      }
      if (gesture.pointers.size < 2) {
        gesture.pinchDistance = null;
        gesture.pinchMidpoint = null;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const handleCanvasWheel = useCallback(
    (event: ReactWheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const terrain = gameRef.current.terrain;
      const world = cameraWorldForTerrain(terrain);
      const point = canvasPointFromClient(
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      cameraModeRef.current = "manual";

      if (event.ctrlKey || event.metaKey) {
        cameraRef.current = zoomCameraAtScreenPoint(
          cameraRef.current,
          cameraRef.current.zoom * Math.exp(-event.deltaY * 0.0025),
          point,
          CAMERA_VIEWPORT,
          world,
        );
        return;
      }

      cameraRef.current = panCameraByScreenDelta(
        cameraRef.current,
        {
          x: -(event.shiftKey ? event.deltaY : event.deltaX),
          y: -(event.shiftKey ? 0 : event.deltaY),
        },
        CAMERA_VIEWPORT,
        world,
      );
    },
    [],
  );

  const handleAudioContextState = useCallback(
    (state: RuntimeAudioContextState) => {
      const game = gameRef.current;
      if (state === "running") {
        game.audioAvailable = true;
        game.audioDiagnostic = null;
      } else if (state === "interrupted") {
        game.audioAvailable = false;
        game.audioDiagnostic =
          "Аудио прервано системой iPhone/iPad. Нажмите повторное подключение после возврата в игру.";
      } else if (state === "closed") {
        game.audioAvailable = false;
        game.audioDiagnostic =
          "Аудиодвижок закрыт. Нажмите повторное подключение, чтобы создать его заново.";
      } else if (!document.hidden) {
        game.audioAvailable = false;
        game.audioDiagnostic =
          "Браузер приостановил аудио. Нажмите повторное подключение.";
      }
      refresh();
    },
    [refresh],
  );

  const ensureAudio = useCallback(async () => {
    const game = gameRef.current;
    if (!game.audio.musicEnabled && !game.audio.sfxEnabled) {
      return null;
    }

    let audio: AudioDirector | null = null;
    try {
      audio =
        audioRef.current ??
        createAudioDirector(handleAudioContextState);
      if (!audio) {
        game.audioAvailable = false;
        game.audioDiagnostic =
          "Этот браузер не предоставляет Web Audio API.";
        refresh();
        return null;
      }
      audioRef.current = audio;
      audio.updateSettings(game.audio);
      audio.setMusicState(audioMusicState(game));
      audio.setPaused(game.paused);
      const activation = await audio.activate(game.audio);
      if (audioRef.current !== audio) {
        void audio.dispose().catch(() => undefined);
        return null;
      }
      const availabilityChanged = !game.audioAvailable;
      game.audioAvailable = true;
      game.audioDiagnostic = null;
      console.debug(
        "[afterglow:audio] activated",
        JSON.stringify({
          userActivationIsActive: activation.userActivationIsActive,
          ...audio.debugSnapshot(),
        }),
      );
      if (availabilityChanged) {
        refresh();
      }
      return audio;
    } catch (error) {
      const failedAudio = audio;
      if (failedAudio && audioRef.current !== failedAudio) {
        void failedAudio.dispose().catch(() => undefined);
        return null;
      }
      audioRef.current = null;
      game.audioAvailable = false;
      game.audioDiagnostic =
        error instanceof Error
          ? `Браузер не запустил аудио: ${error.message}`
          : "Браузер не запустил аудио по неизвестной причине.";
      console.warn(
        "[afterglow:audio] activation failed",
        JSON.stringify({
          contextState: failedAudio?.state ?? "unavailable",
          userActivationIsActive:
            navigator.userActivation?.isActive ?? null,
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        }),
      );
      void failedAudio?.dispose().catch(() => undefined);
      refresh();
      return null;
    }
  }, [handleAudioContextState, refresh]);

  const playAudioEvent = useCallback(
    async (event: GameAudioEvent) => {
      const audio = await ensureAudio();
      if (!audio) {
        return;
      }
      try {
        audio.play(event);
      } catch (error) {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        gameRef.current.audioAvailable = false;
        gameRef.current.audioDiagnostic =
          error instanceof Error
            ? `Ошибка воспроизведения: ${error.message}`
            : "Неизвестная ошибка воспроизведения.";
        console.warn("[afterglow:audio] playback failed", error);
        void audio.dispose().catch(() => undefined);
        refresh();
      }
    },
    [ensureAudio, refresh],
  );

  const playUiAudio = useCallback(
    (cue: UiAudioCue, pan = 0) => {
      void playAudioEvent({
        type: "ui",
        cue,
        pan,
        seed: gameRef.current.seed + gameRef.current.turn,
      });
    },
    [playAudioEvent],
  );

  const logAudioSmoke = useCallback(
    (label: string, audio: AudioDirector) => {
      window.setTimeout(() => {
        if (audioRef.current !== audio) {
          return;
        }
        console.debug(
          `[afterglow:audio] ${label}`,
          JSON.stringify(audio.debugSnapshot()),
        );
      }, 180);
    },
    [],
  );

  const updateAudioPreferences = useCallback(
    (update: Partial<AudioPreferences>) => {
      const game = gameRef.current;
      game.audio = { ...game.audio, ...update };
      saveAudioPreferences(window.localStorage, game.audio);
      audioRef.current?.updateSettings(game.audio);
      refresh();
      if (game.audio.musicEnabled || game.audio.sfxEnabled) {
        void ensureAudio();
      }
    },
    [ensureAudio, refresh],
  );

  useEffect(() => {
    const game = gameRef.current;
    game.audio = loadAudioPreferences(window.localStorage);
    refresh();
    return () => {
      const audio = audioRef.current;
      audioRef.current = null;
      void audio?.dispose().catch(() => undefined);
    };
  }, [refresh]);

  const focusAfterWeaponSelectorClose = useCallback(
    (outcome: SelectorCloseOutcome) =>
      scheduleSelectorFocus(outcome, {
        gameplayOwner: canvasRef.current,
        trigger: weaponTriggerRef.current,
      }),
    [],
  );

  const closeWeaponSelector = useCallback(
    (outcome: SelectorCloseOutcome = "cancelled") => {
      setWeaponSelectorOpen(false);
      weaponCloseOutcomeRef.current = outcome;
      if (weaponDialogRef.current?.open) {
        weaponDialogRef.current.close();
        return;
      }
      weaponCloseOutcomeRef.current = null;
      focusAfterWeaponSelectorClose(outcome);
      playUiAudio("selector-close");
    },
    [focusAfterWeaponSelectorClose, playUiAudio],
  );

  const focusAfterShieldSelectorClose = useCallback(
    (outcome: SelectorCloseOutcome) =>
      scheduleSelectorFocus(outcome, {
        gameplayOwner: canvasRef.current,
        trigger: shieldTriggerRef.current,
      }),
    [],
  );

  const closeShieldSelector = useCallback(
    (outcome: SelectorCloseOutcome = "cancelled") => {
      setShieldSelectorOpen(false);
      shieldCloseOutcomeRef.current = outcome;
      if (shieldDialogRef.current?.open) {
        shieldDialogRef.current.close();
        return;
      }
      shieldCloseOutcomeRef.current = null;
      focusAfterShieldSelectorClose(outcome);
      playUiAudio("selector-close");
    },
    [focusAfterShieldSelectorClose, playUiAudio],
  );

  const resetTransientSelectorsForTurnChange = useCallback(() => {
    setWeaponSelectorOpen(false);
    setWeaponSelectorFilter("all");
    setShieldSelectorOpen(false);
    if (weaponDialogRef.current?.open) {
      weaponDialogRef.current.close();
    }
    if (shieldDialogRef.current?.open) {
      shieldDialogRef.current.close();
    }
  }, []);

  const openWeaponSelector = useCallback(() => {
    const game = gameRef.current;
    if (
      game.phase !== "aiming" ||
      game.paused ||
      window.matchMedia("(orientation: portrait)").matches
    ) {
      return;
    }
    setShieldSelectorOpen(false);
    if (shieldDialogRef.current?.open) {
      shieldDialogRef.current.close();
    }
    setWeaponSelectorFilter("all");
    setWeaponSelectorOpen(true);
    playUiAudio("selector-open");
  }, [playUiAudio]);

  const openShieldSelector = useCallback(() => {
    const game = gameRef.current;
    if (
      !isInfiniteArsenalMode(game.mode) ||
      game.phase !== "aiming" ||
      game.paused ||
      window.matchMedia("(orientation: portrait)").matches
    ) {
      return;
    }
    setWeaponSelectorOpen(false);
    if (weaponDialogRef.current?.open) {
      weaponDialogRef.current.close();
    }
    setShieldSelectorOpen(true);
    playUiAudio("selector-open");
  }, [playUiAudio]);

  useEffect(() => {
    const portrait = window.matchMedia("(orientation: portrait)");
    const closeInPortrait = () => {
      if (portrait.matches) {
        if (weaponDialogRef.current?.open) {
          closeWeaponSelector();
        }
        if (shieldDialogRef.current?.open) {
          closeShieldSelector();
        }
      }
    };

    portrait.addEventListener("change", closeInPortrait);
    closeInPortrait();
    return () => portrait.removeEventListener("change", closeInPortrait);
  }, [closeShieldSelector, closeWeaponSelector]);

  useEffect(() => {
    const dialog = weaponDialogRef.current;
    if (!dialog) {
      return;
    }

    if (!weaponSelectorOpen) {
      if (dialog.open) {
        dialog.close();
      }
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    const visibleWeapons = weaponsForSelectorFilter(weaponSelectorFilter);
    const visibleExperimental =
      infiniteArsenal &&
      (weaponSelectorFilter === "all" ||
        weaponSelectorFilter === "experimental")
        ? EXPERIMENTAL_ULTIMATES
        : [];
    const visibleIds: readonly PlayableWeaponId[] = [
      ...visibleWeapons.map((weapon) => weapon.id),
      ...visibleExperimental.map((ultimate) => ultimate.id),
    ];
    const focusWeapon = visibleIds.includes(selectedPlayableId)
      ? selectedPlayableId
      : visibleIds[0];
    const frame = requestAnimationFrame(() => {
      if (focusWeapon) {
        weaponOptionRefs.current[focusWeapon]?.focus();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [
    selectedPlayableId,
    infiniteArsenal,
    weaponSelectorFilter,
    weaponSelectorOpen,
  ]);

  useEffect(() => {
    const dialog = shieldDialogRef.current;
    if (!dialog) {
      return;
    }

    if (!shieldSelectorOpen) {
      if (dialog.open) {
        dialog.close();
      }
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
    const frame = requestAnimationFrame(() => {
      shieldOptionRefs.current[activeTank.shieldId]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTank.shieldId, shieldSelectorOpen]);

  const finishShot = useCallback(() => {
    const game = gameRef.current;
    const shot = shotRef.current;
    if (!shot || shot.completed) {
      return;
    }

    shot.completed = true;
    const outcome = shotOutcomeText(game, shot);
    game.message = outcome;
    resetTransientSelectorsForTurnChange();

    const somebodyDestroyed = game.tanks.some((tank) => tank.health <= 0);
    game.turn += 1;
    if (somebodyDestroyed || game.turn >= MAX_TURNS_PER_ROUND) {
      completeRound(game);
      audioRef.current?.setMusicState("round-result");
      playUiAudio(game.lastRoundWasDraw ? "draw" : "round-end");
    } else {
      game.activePlayer = nextPlayerIndex(shot.owner);
      restoreAvailableSelectedWeapon(
        game.tanks[game.activePlayer],
        game.mode,
      );
      game.phase = "aiming";
      audioRef.current?.setMusicState("aiming");
      playUiAudio("turn-change");
      game.message = `${outcome} ${game.tanks[game.activePlayer].name}: учитывайте ветер и след прошлого выстрела.`;
    }

    shotRef.current = null;
    cameraModeRef.current = "auto";
    refresh();
  }, [playUiAudio, refresh, resetTransientSelectorsForTurnChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const renderFrame = (now: number) => {
      const game = gameRef.current;
      const delta = Math.min(
        0.033,
        Math.max(0, (now - (lastFrameRef.current || now)) / 1_000),
      );
      lastFrameRef.current = now;

      if (!game.paused) {
        updateParticles(
          particlesRef.current,
          delta,
          particlePoolRef.current,
        );
      }

      const shot = shotRef.current;
      if (shot && !game.paused) {
        shot.elapsedMs += delta * 1_000;
      }
      const cameraProgress = shot
        ? clamp(shot.elapsedMs / shot.duration, 0, 1)
        : 0;
      const world = cameraWorldForTerrain(game.terrain);

      if (cameraModeRef.current === "auto") {
        const focusPoint = shot
          ? shotCameraTarget(shot, cameraProgress)
          : game.phase === "aiming" || game.phase === "intro"
            ? cameraTargetForTank(game.tanks[game.activePlayer])
            : null;
        if (focusPoint) {
          cameraRef.current = moveCameraToward(
            cameraRef.current,
            focusPoint,
            delta,
            CAMERA_VIEWPORT,
            world,
            shot && !game.reducedMotion ? 9.5 : 7,
          );
        }
      } else {
        cameraRef.current = clampCamera(
          cameraRef.current,
          CAMERA_VIEWPORT,
          world,
        );
      }
      const camera = cameraRef.current;

      context.setTransform(1, 0, 0, 1, 0, 0);
      drawBackdrop(context, now, camera);
      const cameraOffset = cameraShakeOffset(
        shot,
        cameraProgress,
        game,
      );
      context.save();
      context.beginPath();
      context.rect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
      context.clip();
      context.translate(
        VIEWPORT_WIDTH / 2 + cameraOffset.x,
        VIEWPORT_HEIGHT / 2 + cameraOffset.y,
      );
      context.scale(camera.zoom, camera.zoom);
      context.translate(-camera.center.x, -camera.center.y);

      const terrainCanvas = renderTerrain(
        game.terrain,
        game.terrainRevision,
        game.terrainDirtyRegion,
        terrainCacheRef,
      );
      if (
        terrainCacheRef.current?.revision === game.terrainRevision
      ) {
        game.terrainDirtyRegion = null;
      }
      context.drawImage(terrainCanvas, 0, 0);

      drawTank(
        context,
        game.tanks[0],
        game.phase === "aiming" && game.activePlayer === 0,
        now,
      );
      drawTank(
        context,
        game.tanks[1],
        game.phase === "aiming" && game.activePlayer === 1,
        now,
      );

      if (shot) {
        const progress = cameraProgress;
        drawShot(context, shot, progress, game, now);

        if (!game.paused && !shot.resolved && progress >= shot.resolvedAt) {
          shot.resolved = true;
          const previousHealth = game.tanks.map((tank) => tank.health);
          const previousY = game.tanks.map((tank) => tank.y);
          const materialBeforeResolution = audioMaterialAtImpact(game, shot);
          resolveWeapon(game, shot);
          spawnImpactParticles(
            particlesRef.current,
            shot,
            game.effectLevel,
            particlePoolRef.current,
            window.matchMedia("(max-width: 900px)").matches,
          );
          const damages = game.tanks.flatMap((tank, index) => {
            const amount = Math.max(
              0,
              (previousHealth[index] ?? tank.health) - tank.health,
            );
            if (amount <= 0) {
              return [];
            }
            const direct = shot.impactPoints.some(
              (point) =>
                distance(point, { x: tank.x, y: tank.y - 5 }) <=
                TANK_HALF_HEIGHT + 7,
            );
            return [
              {
                amount,
                bucket: damageBucket(amount, tank.maxHealth),
                direct,
                destroyed: tank.health <= 0,
                pan: audioPanForX(tank.x, game.terrain.width),
              },
            ];
          });
          const landings = game.tanks.flatMap((tank, index) => {
            const distance = Math.max(
              0,
              tank.y - (previousY[index] ?? tank.y),
            );
            return distance > 8
              ? [
                  {
                    distance,
                    destroyed: tank.health <= 0,
                    pan: audioPanForX(tank.x, game.terrain.width),
                  },
                ]
              : [];
          });
          const criticalCrossings = game.tanks.flatMap((tank, index) => {
            const previous = previousHealth[index] ?? tank.health;
            return previous / tank.maxHealth > 0.3 &&
              tank.health / tank.maxHealth <= 0.3 &&
              tank.health > 0
              ? [{ pan: audioPanForX(tank.x, game.terrain.width) }]
              : [];
          });
          void playAudioEvent({
            type: "resolution",
            weaponId: shot.weaponId,
            material:
              damages.some((damage) => damage.direct)
                ? "hull"
                : materialBeforeResolution,
            damages,
            landings,
            criticalCrossings,
            shieldEvents: game.shieldEvents.map(({ event }) => event),
            terrainCollapse: causesTerrainCollapse(shot),
            fizzled: shot.fizzled,
            pan: audioPanForX(
              shot.finalPoint.x,
              game.terrain.width,
            ),
            seed: shot.seed,
          });
          refresh();
        }

        if (!game.paused && progress >= shot.endsAt) {
          finishShot();
        }
      }

      drawParticles(context, particlesRef.current);
      context.restore();
      drawMinimap(
        context,
        terrainCacheRef.current?.minimap ?? terrainCanvas,
        game,
        cameraRef.current,
      );
      frameRef.current = requestAnimationFrame(renderFrame);
    };

    frameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [finishShot, playAudioEvent, refresh]);

  const adjustAngle = useCallback(
    (next: number) => {
      const game = gameRef.current;
      if (game.phase !== "aiming" || game.paused) {
        return;
      }
      updatePlayerAim(game.tanks[game.activePlayer], {
        angleDegrees: clamp(Math.round(next), 5, 88),
      });
      refresh();
    },
    [refresh],
  );

  const adjustPower = useCallback(
    (next: number) => {
      const game = gameRef.current;
      if (game.phase !== "aiming" || game.paused) {
        return;
      }
      const tank = game.tanks[game.activePlayer];
      const healthLimit = Math.max(
        260,
        Math.round(1_000 * (tank.health / tank.maxHealth)),
      );
      updatePlayerAim(tank, {
        power: clamp(Math.round(next / 10) * 10, 180, healthLimit),
      });
      refresh();
    },
    [refresh],
  );

  const selectWeapon = useCallback(
    (weaponId: WeaponId) => {
      const game = gameRef.current;
      if (game.phase !== "aiming" || game.paused) {
        return;
      }
      const tank = game.tanks[game.activePlayer];
      if (!selectPlayerWeapon(tank, weaponId, game.mode)) {
        game.message = `${getWeapon(weaponId).name}: боезапас исчерпан.`;
        playUiAudio("unavailable");
        refresh();
        return;
      }
      tank.selectedExperimental = null;
      game.message = weaponStatus(weaponId);
      playUiAudio(
        "weapon-select",
        audioPanForX(tank.x, game.terrain.width),
      );
      refresh();
    },
    [playUiAudio, refresh],
  );

  const selectWeaponFromSelector = useCallback(
    (weaponId: WeaponId) => {
      const game = gameRef.current;
      if (
        !canUseWeapon(
          game,
          game.tanks[game.activePlayer],
          weaponId,
        )
      ) {
        return;
      }
      selectWeapon(weaponId);
      closeWeaponSelector("committed");
    },
    [closeWeaponSelector, selectWeapon],
  );

  const selectExperimentalFromSelector = useCallback(
    (ultimateId: ExperimentalUltimateId) => {
      const game = gameRef.current;
      if (
        !isInfiniteArsenalMode(game.mode) ||
        game.phase !== "aiming" ||
        game.paused
      ) {
        return;
      }
      const tank = game.tanks[game.activePlayer];
      const ultimate = getExperimentalUltimate(ultimateId);
      tank.selectedExperimental = ultimateId;
      game.message =
        `${ultimate.name}: Experimental Showcase, бесконечный доступ. ` +
        `${ultimate.description}`;
      playUiAudio(
        "weapon-select",
        audioPanForX(tank.x, game.terrain.width),
      );
      closeWeaponSelector("committed");
      refresh();
    },
    [closeWeaponSelector, playUiAudio, refresh],
  );

  const handleWeaponGridKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const currentOption = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-weapon-id]",
    );

    if (isWeaponSelectorCloseKey(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      closeWeaponSelector();
      return;
    }

    if (
      (event.key === "Enter" || event.key === " ") &&
      currentOption?.dataset.weaponId
    ) {
      event.preventDefault();
      event.stopPropagation();
      const requestedId = currentOption.dataset.weaponId;
      if (isExperimentalUltimateId(requestedId)) {
        selectExperimentalFromSelector(requestedId);
      } else {
        selectWeaponFromSelector(requestedId as WeaponId);
      }
      return;
    }

    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const currentId =
      (currentOption?.dataset.weaponId as PlayableWeaponId | undefined) ??
      selectedPlayableId;
    const nextId = nextWeaponFocus(
      selectorPlayableIds,
      currentId,
      event.key,
    );
    if (!nextId) {
      return;
    }

    event.preventDefault();
    weaponOptionRefs.current[nextId]?.focus();
  };

  const selectShieldFromSelector = useCallback(
    (shieldId: ShieldId) => {
      const game = gameRef.current;
      if (
        !isInfiniteArsenalMode(game.mode) ||
        game.phase !== "aiming" ||
        game.paused
      ) {
        return;
      }
      const tank = game.tanks[game.activePlayer];
      const shield = getShield(shieldId);
      tank.shieldId = shieldId;
      tank.maxShield = shieldCapacity(shieldId, tank.reserveShield);
      tank.shield = tank.maxShield;
      tank.shieldResponse = null;
      game.message = `${tank.name}: выбран ${shield.name}, заряд ${Math.ceil(
        tank.shield,
      )}. Выбор второго пилота останется независимым.`;
      playUiAudio(
        "shield-select",
        audioPanForX(tank.x, game.terrain.width),
      );
      closeShieldSelector("committed");
      refresh();
    },
    [closeShieldSelector, playUiAudio, refresh],
  );

  const handleShieldGridKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const currentOption = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-shield-id]",
    );

    if (isShieldSelectorCloseKey(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      closeShieldSelector();
      return;
    }

    if (
      (event.key === "Enter" || event.key === " ") &&
      currentOption?.dataset.shieldId
    ) {
      event.preventDefault();
      event.stopPropagation();
      selectShieldFromSelector(
        currentOption.dataset.shieldId as ShieldId,
      );
      return;
    }

    const currentId =
      (currentOption?.dataset.shieldId as ShieldId | undefined) ??
      activeTank.shieldId;
    const nextId = nextShieldFocus(
      SHIELDS.map((shield) => shield.id),
      currentId,
      event.key,
    );
    if (!nextId) {
      return;
    }

    event.preventDefault();
    shieldOptionRefs.current[nextId]?.focus();
  };

  const cycleWeapon = useCallback(
    (direction: -1 | 1) => {
      const game = gameRef.current;
      if (game.phase !== "aiming" || game.paused) {
        return;
      }
      const current = chooseAvailableWeapon(game, game.activePlayer);
      const currentIndex = WEAPONS.findIndex(
        (weapon) => weapon.id === current,
      );

      for (let offset = 1; offset <= WEAPONS.length; offset += 1) {
        const index =
          (currentIndex + direction * offset + WEAPONS.length * 2) %
          WEAPONS.length;
        const candidate = WEAPONS[index];
        if (
          candidate &&
          canUseWeapon(
            game,
            game.tanks[game.activePlayer],
            candidate.id,
          )
        ) {
          selectWeapon(candidate.id);
          break;
        }
      }
    },
    [selectWeapon],
  );

  const fire = useCallback(() => {
    const game = gameRef.current;
    if (game.phase !== "aiming" || game.paused || shotRef.current) {
      return;
    }

    const owner = game.activePlayer;
    const tank = game.tanks[owner];
    const experimentalId = isInfiniteArsenalMode(game.mode)
      ? tank.selectedExperimental
      : null;
    const weaponId: PlayableWeaponId =
      experimentalId ?? chooseAvailableWeapon(game, owner);
    game.shieldEvents = [];
    game.tanks.forEach((player) => {
      player.shieldResponse = null;
    });
    if (!isExperimentalUltimateId(weaponId)) {
      consumePlayerWeapon(tank, weaponId, game.mode);
    }

    const shot = isExperimentalUltimateId(weaponId)
      ? buildExperimentalShot(game, owner, weaponId)
      : buildShot(game, owner, weaponId);
    shotRef.current = shot;
    cameraModeRef.current = "auto";
    game.phase = "firing";
    audioRef.current?.setMusicState("flight");
    game.message = `${tank.name} запускает «${
      isExperimentalUltimateId(weaponId)
        ? getExperimentalUltimate(weaponId).name
        : getWeapon(weaponId).name
    }».`;
    refresh();

    void playAudioEvent({
      type: "weapon-timeline",
      weaponId,
      durationMs: shot.duration,
      resolvedAtMs: shot.resolvedAt * shot.duration,
      impactTimesMs: shot.impactTimes.map(
        (impactTime) => impactTime * shot.duration,
      ),
      fizzled: shot.fizzled,
      pan: audioPanForX(shot.finalPoint.x, game.terrain.width),
      seed: shot.seed,
    });
  }, [playAudioEvent, refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const game = gameRef.current;
      const action = getGameKeyboardAction(event.code, {
        phase: game.phase,
        paused: game.paused,
        target: event.target,
      });

      if (action === null) {
        return;
      }

      if (action.type === "toggle-pause") {
        game.paused = !game.paused;
        audioRef.current?.setPaused(game.paused);
        playUiAudio(game.paused ? "pause" : "resume");
        refresh();
        return;
      }

      const tank = game.tanks[game.activePlayer];
      switch (action.type) {
        case "adjust-angle":
          event.preventDefault();
          adjustAngle(
            tank.angleDegrees +
              angleDeltaForScreenDirection(
                action.screenDirection,
                tank.direction,
              ),
          );
          break;
        case "adjust-power":
          event.preventDefault();
          adjustPower(tank.power + action.delta);
          break;
        case "cycle-weapon":
          cycleWeapon(action.direction);
          break;
        case "fire":
          event.preventDefault();
          void fire();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    adjustAngle,
    adjustPower,
    cycleWeapon,
    fire,
    playUiAudio,
    refresh,
  ]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        const game = gameRef.current;
        if (game.phase === "aiming" || game.phase === "firing") {
          game.paused = true;
          audioRef.current?.setPaused(true);
          refresh();
        }
        void audioRef.current
          ?.setHidden(true)
          .catch((error: unknown) => {
            console.warn("[afterglow:audio] suspend failed", error);
          });
        return;
      }
      const game = gameRef.current;
      if (
        audioRef.current &&
        (game.audio.musicEnabled || game.audio.sfxEnabled)
      ) {
        game.audioAvailable = false;
        game.audioDiagnostic =
          "После возврата на iPhone звук нужно восстановить прямым касанием.";
        refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      gameRef.current.reducedMotion = true;
      gameRef.current.effectLevel = "reduced";
      refresh();
    }
  }, [refresh]);

  const selectMatchMode = useCallback(
    (mode: DemoMatchMode) => {
      const game = gameRef.current;
      if (game.phase !== "intro") {
        return;
      }
      game.mode = mode;
      game.message = isInfiniteArsenalMode(mode)
        ? "Infinite Arsenal выбран: канонические 33 и отдельные Experimental 10 доступны бесконечно, магазин отключён."
        : "Quick Demo выбран: finite ammo расходуется, между раундами работает магазин.";
      playUiAudio("mode-select");
      refresh();
    },
    [playUiAudio, refresh],
  );

  const startMatch = useCallback(() => {
    const game = gameRef.current;
    const audioActivation = ensureAudio();
    cameraModeRef.current = "auto";
    game.phase = "aiming";
    cameraRef.current = createCamera(
      cameraTargetForTank(game.tanks[game.activePlayer]),
      CAMERA_VIEWPORT,
      cameraWorldForTerrain(game.terrain),
      cameraRef.current.zoom,
    );
    game.message = isInfiniteArsenalMode(game.mode)
      ? `${game.tanks[game.activePlayer].name}: Infinite Arsenal — выберите каноническое оружие или Experimental Ultimate.`
      : `${game.tanks[game.activePlayer].name}: выберите оружие и сделайте первый выстрел.`;
    refresh();
    void audioActivation.then((audio) => {
      audio?.setMusicState("aiming");
      audio?.play({
        type: "ui",
        cue: "match-start",
        seed: game.seed,
      });
      if (audio) {
        logAudioSmoke("start-smoke", audio);
      }
    });
  }, [ensureAudio, logAudioSmoke, refresh]);

  const openRoundResult = useCallback(() => {
    const game = gameRef.current;
    if (game.round >= TOTAL_ROUNDS) {
      game.phase = "matchEnd";
      game.message = "Три раунда завершены.";
      audioRef.current?.setMusicState("match-end");
      playUiAudio("match-end");
    } else if (shouldOpenInterroundShop(game.mode)) {
      game.phase = "shop";
      game.shopPlayer = 0;
      game.message = `${game.tanks[0].name}: выберите покупки на следующий раунд.`;
      audioRef.current?.setMusicState("shop");
      playUiAudio("shop-open");
    } else {
      prepareNextRound(game);
      cameraModeRef.current = "auto";
      audioRef.current?.setMusicState("aiming");
      playUiAudio("round-start");
    }
    refresh();
  }, [playUiAudio, refresh]);

  const buyWeapon = useCallback(
    (weaponId: WeaponId) => {
      const game = gameRef.current;
      if (game.phase !== "shop") {
        return;
      }
      const tank = game.tanks[game.shopPlayer];
      const result = purchaseWeapon({
        weaponId,
        inventory: tank.inventory,
        credits: tank.credits,
      });
      if (!result.ok) {
        const reason =
          result.reason === "inventory-full"
            ? `достигнут лимит ${MAX_INVENTORY}`
            : result.reason === "insufficient-credits"
              ? "недостаточно средств"
              : "базовый снаряд уже бесконечен";
        game.message = `${getWeapon(weaponId).name}: ${reason}.`;
        playUiAudio("unavailable");
        refresh();
        return;
      }
      tank.credits = result.credits;
      tank.inventory = result.inventory;
      game.message =
        `${tank.name}: «${getWeapon(weaponId).name}» +${result.quote.quantity} ` +
        `за ₡ ${formatCredits(result.spent)}${result.quote.isPartialBundle ? " (частичный bundle, +20%)" : ""}.`;
      playUiAudio("purchase");
      refresh();
    },
    [playUiAudio, refresh],
  );

  const sellOneWeapon = useCallback(
    (weaponId: WeaponId) => {
      const game = gameRef.current;
      if (game.phase !== "shop") {
        return;
      }
      const tank = game.tanks[game.shopPlayer];
      const result = sellWeapon({
        weaponId,
        inventory: tank.inventory,
        credits: tank.credits,
        quantity: 1,
      });
      if (!result.ok) {
        game.message =
          result.reason === "no-inventory" ||
          result.reason === "insufficient-inventory"
            ? `${getWeapon(weaponId).name}: нечего продавать.`
            : "Бесконечную Baby Missile нельзя продать.";
        playUiAudio("unavailable");
        refresh();
        return;
      }
      tank.inventory = result.inventory;
      tank.credits = result.credits;
      game.message =
        `${tank.name}: продана 1 ед. «${getWeapon(weaponId).name}» ` +
        `за ₡ ${formatCredits(result.earned)} (demo sell-back 60%).`;
      playUiAudio("sale");
      refresh();
    },
    [playUiAudio, refresh],
  );

  const buyUpgrade = useCallback(
    (kind: "health" | "shield") => {
      const game = gameRef.current;
      if (game.phase !== "shop") {
        return;
      }
      const tank = game.tanks[game.shopPlayer];
      const price = kind === "health" ? 3_000 : 4_500;
      const upgradeAtCap =
        kind === "health"
          ? tank.bonusHealth >= 40
          : tank.reserveShield >= 60;
      if (tank.credits < price || upgradeAtCap) {
        playUiAudio("unavailable");
        return;
      }
      tank.credits -= price;
      if (kind === "health") {
        tank.bonusHealth = Math.min(40, tank.bonusHealth + 20);
        game.message = `${tank.name}: усиление корпуса +20 к состоянию следующего раунда.`;
      } else {
        tank.reserveShield = Math.min(60, tank.reserveShield + 25);
        game.message = `${tank.name}: щит +25 на следующий раунд.`;
      }
      playUiAudio("upgrade");
      refresh();
    },
    [playUiAudio, refresh],
  );

  const finishShopping = useCallback(() => {
    const game = gameRef.current;
    if (game.phase !== "shop") {
      return;
    }
    if (game.shopPlayer === 0) {
      game.shopPlayer = 1;
      game.message = `${game.tanks[1].name}: теперь ваши покупки.`;
      playUiAudio("turn-change");
    } else {
      prepareNextRound(game);
      cameraModeRef.current = "auto";
      audioRef.current?.setMusicState("aiming");
      playUiAudio("round-start");
    }
    refresh();
  }, [playUiAudio, refresh]);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (
      game.phase !== "aiming" &&
      game.phase !== "firing" &&
      !game.paused
    ) {
      return;
    }
    game.paused = !game.paused;
    audioRef.current?.setPaused(game.paused);
    playUiAudio(game.paused ? "pause" : "resume");
    if (!game.paused) {
      void ensureAudio();
    }
    refresh();
  }, [ensureAudio, playUiAudio, refresh]);

  const resetGame = useCallback(() => {
    const previous = gameRef.current;
    gameRef.current = createGame(previous.seed + 1);
    gameRef.current.audio = previous.audio;
    gameRef.current.audioAvailable = previous.audioAvailable;
    gameRef.current.audioDiagnostic = previous.audioDiagnostic;
    gameRef.current.reducedMotion = previous.reducedMotion;
    gameRef.current.effectLevel = previous.effectLevel;
    cameraRef.current = createCamera(
      cameraTargetForTank(
        gameRef.current.tanks[gameRef.current.activePlayer],
      ),
      CAMERA_VIEWPORT,
      cameraWorldForTerrain(gameRef.current.terrain),
    );
    cameraModeRef.current = "auto";
    shotRef.current = null;
    particlesRef.current = [];
    particlePoolRef.current = [];
    terrainCacheRef.current = null;
    setArsenalFilter("all");
    setWeaponSelectorFilter("all");
    setWeaponSelectorOpen(false);
    setShieldSelectorOpen(false);
    audioRef.current?.cancelAll();
    audioRef.current?.setPaused(false);
    audioRef.current?.setMusicState("intro");
    playUiAudio("toggle");
    refresh();
  }, [playUiAudio, refresh]);

  const toggleMusic = useCallback(() => {
    const game = gameRef.current;
    updateAudioPreferences({
      musicEnabled: !game.audio.musicEnabled,
    });
    playUiAudio("toggle");
  }, [playUiAudio, updateAudioPreferences]);

  const toggleSfx = useCallback(() => {
    const game = gameRef.current;
    const sfxEnabled = !game.audio.sfxEnabled;
    updateAudioPreferences({ sfxEnabled });
    if (sfxEnabled) {
      playUiAudio("toggle");
    }
  }, [playUiAudio, updateAudioPreferences]);

  const retryAudio = useCallback(() => {
    const previousAudio = audioRef.current;
    audioRef.current = null;
    void previousAudio?.dispose().catch(() => undefined);
    void ensureAudio().then((audio) => {
      audio?.play({
        type: "ui",
        cue: "sound-check",
        seed: gameRef.current.seed + gameRef.current.turn,
      });
      if (audio) {
        logAudioSmoke("sound-check-smoke", audio);
      }
    });
  }, [ensureAudio, logAudioSmoke]);

  const toggleMotion = useCallback(() => {
    const game = gameRef.current;
    game.reducedMotion = !game.reducedMotion;
    if (game.reducedMotion && game.effectLevel === "full") {
      game.effectLevel = "reduced";
    }
    refresh();
  }, [refresh]);

  const cycleEffects = useCallback(() => {
    const game = gameRef.current;
    game.effectLevel =
      game.effectLevel === "full"
        ? "balanced"
        : game.effectLevel === "balanced"
          ? "reduced"
          : "full";
    refresh();
  }, [refresh]);

  const winner =
    model.tanks[0].wins === model.tanks[1].wins
      ? null
      : model.tanks[0].wins > model.tanks[1].wins
        ? model.tanks[0]
        : model.tanks[1];
  const shopTank = model.tanks[model.shopPlayer];
  const filteredWeapons = weaponsForSelectorFilter(arsenalFilter);
  const eligibleInterestBank = shopTank.credits;
  const interestPreview = calculateInterest(eligibleInterestBank);
  const audioSettings = (
    <div className={styles.audioSettings} aria-label="Настройки аудио">
      {model.audioAvailable ? (
        <div className={styles.audioTest}>
          <button
            type="button"
            className={styles.audioTestButton}
            onClick={retryAudio}
            disabled={!model.audio.sfxEnabled}
          >
            Проверить звук
          </button>
          <p>
            {model.audio.sfxEnabled
              ? "На iPhone нажмите один раз: должен прозвучать высокий сигнал, затем начнётся музыка."
              : "Сначала включите «Звуки», затем нажмите проверку."}
          </p>
        </div>
      ) : (
        <div className={styles.audioRecovery} aria-live="polite">
          <p>
            {model.audioDiagnostic ??
              "Аудио недоступно в браузере."}
          </p>
          <button
            type="button"
            className={styles.audioUnavailable}
            onClick={retryAudio}
          >
            {model.audio.sfxEnabled
              ? "Перезапустить и проверить звук"
              : "Перезапустить аудио"}
          </button>
        </div>
      )}
      <div className={styles.audioToggleRow}>
        <button
          type="button"
          className={styles.toggleButton}
          aria-pressed={
            model.audioAvailable && model.audio.musicEnabled
          }
          onClick={toggleMusic}
        >
          <span>Музыка</span>
          <span className={styles.toggleState}>
            {!model.audioAvailable
              ? "Недоступно"
              : model.audio.musicEnabled
                ? "Вкл"
                : "Выкл"}
          </span>
        </button>
        <button
          type="button"
          className={styles.toggleButton}
          aria-pressed={
            model.audioAvailable && model.audio.sfxEnabled
          }
          onClick={toggleSfx}
        >
          <span>Звуки</span>
          <span className={styles.toggleState}>
            {!model.audioAvailable
              ? "Недоступно"
              : model.audio.sfxEnabled
                ? "Вкл"
                : "Выкл"}
          </span>
        </button>
      </div>
      <label className={styles.audioVolume}>
        <span>
          Громкость музыки
          <strong>{model.audio.musicVolume}%</strong>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={model.audio.musicVolume}
          onChange={(event) =>
            updateAudioPreferences({
              musicVolume: Number(event.target.value),
            })
          }
          aria-label="Громкость музыки"
        />
      </label>
      <label className={styles.audioVolume}>
        <span>
          Громкость звуков
          <strong>{model.audio.sfxVolume}%</strong>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={model.audio.sfxVolume}
          onChange={(event) =>
            updateAudioPreferences({
              sfxVolume: Number(event.target.value),
            })
          }
          aria-label="Громкость звуков"
        />
      </label>
    </div>
  );

  return (
    <div className={styles.game}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={VIEWPORT_WIDTH}
        height={VIEWPORT_HEIGHT}
        tabIndex={-1}
        data-game-keyboard-owner="aiming"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={releaseCanvasPointer}
        onPointerCancel={releaseCanvasPointer}
        onLostPointerCapture={releaseCanvasPointer}
        onWheel={handleCanvasWheel}
        aria-label="Большое артиллерийское поле. Тяните для прокрутки, используйте pinch или Control с колесом для масштаба."
      />

      {(model.phase === "aiming" || model.phase === "firing") && (
        <div
          className={styles.cameraHud}
          role="group"
          aria-label="Управление камерой"
        >
          <span className={styles.cameraMeta}>
            Карта {model.terrain.width}×{model.terrain.height}
          </span>
          <button
            type="button"
            className={styles.cameraButton}
            onClick={() => panCameraPage(-1)}
            aria-label="Прокрутить карту влево"
            title="Карта влево"
          >
            ←
          </button>
          <button
            type="button"
            className={styles.cameraButton}
            onClick={recenterCamera}
            aria-label="Вернуть камеру к активному танку"
            title="К активному танку"
          >
            ◎
          </button>
          <button
            type="button"
            className={styles.cameraButton}
            onClick={() => panCameraPage(1)}
            aria-label="Прокрутить карту вправо"
            title="Карта вправо"
          >
            →
          </button>
          <button
            type="button"
            className={styles.cameraButton}
            onClick={() => changeCameraZoom(1 / 1.16)}
            aria-label="Отдалить карту"
            title="Отдалить"
          >
            −
          </button>
          <button
            type="button"
            className={styles.cameraButton}
            onClick={() => changeCameraZoom(1.16)}
            aria-label="Приблизить карту"
            title="Приблизить"
          >
            +
          </button>
        </div>
      )}

      <div className={styles.topHud} aria-live="polite">
        {model.tanks.map((tank, index) => (
          <section
            key={tank.id}
            className={`${styles.playerHud} ${
              model.activePlayer === index &&
              (model.phase === "aiming" || model.phase === "firing")
                ? styles.playerHudActive
                : ""
            }`}
            style={playerStyle(tank.color)}
            aria-label={`${tank.name}: состояние ${Math.ceil(
              tank.health,
            )}, ${getShield(tank.shieldId).name}, заряд ${Math.ceil(
              tank.shield,
            )} из ${Math.ceil(tank.maxShield)}`}
          >
            <div className={styles.playerLine}>
              <span className={styles.playerIdentity}>
                <span className={styles.playerDot} aria-hidden="true" />
                <span className={styles.playerName}>{tank.name}</span>
              </span>
              <span className={styles.money}>₡ {formatCredits(tank.credits)}</span>
            </div>
            <div className={styles.healthTrack}>
              <div
                className={styles.healthFill}
                style={{
                  width: `${clamp((tank.health / tank.maxHealth) * 100, 0, 100)}%`,
                }}
              />
            </div>
            <div className={styles.shieldTrack}>
              <div
                className={styles.shieldFill}
                style={{
                  width: `${clamp((tank.shield / Math.max(1, tank.maxShield)) * 100, 0, 100)}%`,
                }}
              />
            </div>
            <div className={styles.meterLabels}>
              <span>Корпус {Math.ceil(tank.health)}</span>
              <span>
                {getShield(tank.shieldId).shortName}{" "}
                {Math.ceil(tank.shield)}/{Math.ceil(tank.maxShield)}
              </span>
            </div>
          </section>
        ))}

        <section className={styles.roundHud} aria-label="Раунд и ветер">
          <p
            className={`${styles.eyebrow} ${
              infiniteArsenal ? styles.showcaseBadge : ""
            }`}
          >
            {infiniteArsenal ? "Infinite Arsenal" : "Quick Match"}
          </p>
          <strong className={styles.roundValue}>
            Раунд {model.round}/{TOTAL_ROUNDS}
          </strong>
          <div className={styles.windLine}>
            <span
              className={styles.windArrow}
              style={
                {
                  "--wind-direction": model.wind < 0 ? -1 : 1,
                } as CSSProperties
              }
              aria-hidden="true"
            >
              ➜
            </span>
            <span>{Math.abs(model.wind)} ветер</span>
          </div>
        </section>
      </div>

      <div className={styles.statusRibbon} role="status">
        {model.message}
      </div>

      {(model.phase === "aiming" || model.phase === "firing") && (
        <button
          type="button"
          className={styles.iconButton}
          onClick={togglePause}
          aria-label="Пауза и настройки"
          title="Пауза (P)"
        >
          {model.paused ? "▶" : "Ⅱ"}
        </button>
      )}

      {(model.phase === "aiming" || model.phase === "firing") &&
        !model.paused &&
        !model.audioAvailable && (
          <button
            type="button"
            className={styles.audioRecoveryButton}
            onClick={retryAudio}
            aria-label="Аудио отключено — повторно включить"
          >
            <span>Аудио отключено</span>
            <strong>Повторить</strong>
          </button>
        )}

      {model.phase === "aiming" && (
        <div
          className={`${styles.controlDeck} ${
            infiniteArsenal ? styles.controlDeckShowcase : ""
          }`}
        >
          <section className={styles.controlPanel} aria-label="Настройка угла">
            <div className={styles.controlHeader}>
              <span className={styles.controlName}>Угол</span>
              <strong className={styles.controlValue}>
                {Math.round(activeTank.angleDegrees)}°
              </strong>
            </div>
            <div className={styles.adjustRow}>
              <button
                type="button"
                className={styles.stepButton}
                onClick={() => adjustAngle(activeTank.angleDegrees - 1)}
                disabled={controlsLocked}
                aria-label="Уменьшить угол"
              >
                −
              </button>
              <input
                className={styles.slider}
                type="range"
                min="5"
                max="88"
                step="1"
                value={activeTank.angleDegrees}
                onChange={(event) => adjustAngle(Number(event.target.value))}
                disabled={controlsLocked}
                aria-label="Угол орудия"
              />
              <button
                type="button"
                className={styles.stepButton}
                onClick={() => adjustAngle(activeTank.angleDegrees + 1)}
                disabled={controlsLocked}
                aria-label="Увеличить угол"
              >
                +
              </button>
            </div>
          </section>

          {infiniteArsenal && (
            <section
              className={styles.shieldControl}
              aria-label="Текущий щит"
            >
              <button
                ref={shieldTriggerRef}
                type="button"
                className={styles.shieldTrigger}
                style={shieldStyle(activeShieldDefinition.accent)}
                onClick={openShieldSelector}
                disabled={controlsLocked}
                aria-haspopup="dialog"
                aria-expanded={shieldSelectorOpen}
                aria-controls="shield-selector-dialog"
                data-game-keyboard-owner="aiming"
                aria-label={`Открыть каталог щитов: ${
                  activeShieldDefinition.name
                }, заряд ${Math.ceil(activeTank.shield)} из ${Math.ceil(
                  activeTank.maxShield,
                )}`}
              >
                <span className={styles.shieldTriggerIcon} aria-hidden="true">
                  {activeShieldDefinition.icon}
                </span>
                <span className={styles.shieldTriggerCopy}>
                  <span className={styles.shieldTriggerEyebrow}>
                    Щит пилота
                  </span>
                  <strong className={styles.shieldTriggerName}>
                    {activeShieldDefinition.shortName}
                  </strong>
                  <span className={styles.shieldTriggerRole}>
                    {activeShieldDefinition.confirmedRole}
                  </span>
                </span>
                <span className={styles.shieldTriggerMeta}>
                  <strong>
                    {Math.ceil(activeTank.shield)}/
                    {Math.ceil(activeTank.maxShield)}
                  </strong>
                  <span>Showcase 6</span>
                </span>
              </button>
            </section>
          )}

          <section
            className={styles.weaponControl}
            aria-label="Текущее оружие"
          >
            <button
              ref={weaponTriggerRef}
              type="button"
              className={styles.weaponTrigger}
              style={weaponStyle(selectedPlayable.accent)}
              onClick={openWeaponSelector}
              disabled={controlsLocked}
              aria-haspopup="dialog"
              aria-expanded={weaponSelectorOpen}
              aria-controls="weapon-selector-dialog"
              data-game-keyboard-owner="aiming"
              aria-label={`Открыть арсенал: ${selectedPlayable.name}, ${selectedPlayable.role}, ${selectedPlayable.stock}`}
            >
              <span className={styles.weaponTriggerIcon} aria-hidden="true">
                {selectedPlayable.icon}
              </span>
              <span className={styles.weaponTriggerCopy}>
                <span className={styles.weaponTriggerEyebrow}>
                  Текущее оружие
                </span>
                <strong className={styles.weaponTriggerName}>
                  {selectedPlayable.name}
                </strong>
                <span className={styles.weaponTriggerRole}>
                  {selectedPlayable.role}
                </span>
              </span>
              <span className={styles.weaponTriggerMeta}>
                <strong>{selectedPlayable.stock}</strong>
                <span>{selectedPlayable.count}</span>
              </span>
            </button>
          </section>

          <section
            className={`${styles.controlPanel} ${styles.firePanel}`}
            aria-label="Настройка силы и огонь"
          >
            <div className={styles.powerBlock}>
              <div className={styles.controlHeader}>
                <span className={styles.controlName}>Сила</span>
                <strong className={styles.controlValue}>
                  {Math.round(activeTank.power)}
                </strong>
              </div>
              <input
                className={styles.slider}
                type="range"
                min="180"
                max={Math.max(
                  260,
                  Math.round(
                    1_000 * (activeTank.health / activeTank.maxHealth),
                  ),
                )}
                step="10"
                value={activeTank.power}
                onChange={(event) => adjustPower(Number(event.target.value))}
                disabled={controlsLocked}
                aria-label="Сила выстрела"
              />
              <span className={styles.shotHint}>
                ← → угол · ↑ ↓ сила · Q/E оружие
              </span>
            </div>
            <button
              type="button"
              className={styles.fireButton}
              onClick={() => void fire()}
              disabled={controlsLocked}
              aria-label={`Огонь: ${selectedPlayable.name}, ${selectedPlayable.role}`}
            >
              Огонь
            </button>
          </section>
        </div>
      )}

      <dialog
        id="weapon-selector-dialog"
        ref={weaponDialogRef}
        className={styles.weaponDialog}
        aria-labelledby="weapon-selector-title"
        onCancel={(event) => {
          event.preventDefault();
          closeWeaponSelector();
        }}
        onClose={() => {
          setWeaponSelectorOpen(false);
          const outcome = weaponCloseOutcomeRef.current;
          weaponCloseOutcomeRef.current = null;
          if (outcome) {
            focusAfterWeaponSelectorClose(outcome);
            playUiAudio("selector-close");
          }
        }}
      >
        <div className={styles.weaponDialogShell}>
          <header className={styles.weaponDialogHeader}>
            <div>
              <p className={styles.weaponDialogEyebrow}>Arsenal Deck</p>
              <h2 id="weapon-selector-title">Выберите оружие</h2>
              <span className={styles.weaponDialogInventoryHint}>
                {infiniteArsenal
                  ? "33 без лимита + 10 showcase · листайте ↓"
                  : "33 оружия · по 1 заряду · листайте ↓"}
              </span>
              <p>
                {infiniteArsenal
                  ? "Канонические 33 + отдельные Experimental 10 · стрелки и Enter"
                  : "Все 33 позиции · стрелки для навигации · Enter для выбора"}
              </p>
            </div>
            <button
              type="button"
              className={styles.weaponDialogClose}
              onClick={() => closeWeaponSelector()}
              aria-label="Закрыть арсенал"
            >
              ×
            </button>
          </header>

          <div
            className={styles.weaponFilterRow}
            role="tablist"
            aria-label="Категории оружия"
          >
            {WEAPON_SELECTOR_FILTERS.filter(
              (filter) =>
                filter.id !== "experimental" || infiniteArsenal,
            ).map((filter) => (
              <button
                type="button"
                role="tab"
                key={filter.id}
                className={`${styles.weaponFilter} ${
                  weaponSelectorFilter === filter.id
                    ? styles.weaponFilterActive
                    : ""
                }`}
                aria-selected={weaponSelectorFilter === filter.id}
                onClick={() => setWeaponSelectorFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div
            className={styles.weaponGrid}
            role="listbox"
            aria-label="Полный каталог оружия"
            onKeyDown={handleWeaponGridKeyDown}
          >
            {selectorWeapons.map((weapon) => {
              const catalogSubtitle = weaponCatalogSubtitle(weapon);
              const ammo = weaponAmmo(activeTank, weapon.id);
              const available = canUseWeapon(
                model,
                activeTank,
                weapon.id,
              );
              const selected = selectedWeapon === weapon.id;
              const availabilityStatus = infiniteArsenal
                ? "Бесконечный доступ"
                : weapon.ammo.kind === "unlimited"
                  ? "Базовый"
                  : available
                    ? `Боезапас ${ammo}`
                    : "Нет заряда";
              const status = selected
                ? "Выбрано"
                : availabilityStatus;
              const accessibleStatus = selected
                ? `Выбрано, ${availabilityStatus}`
                : availabilityStatus;

              return (
                <button
                  type="button"
                  role="option"
                  key={weapon.id}
                  ref={(node) => {
                    weaponOptionRefs.current[weapon.id] = node;
                  }}
                  data-weapon-id={weapon.id}
                  className={`${styles.weaponOption} ${
                    selected ? styles.weaponOptionSelected : ""
                  } ${!available ? styles.weaponOptionUnavailable : ""}`}
                  style={weaponStyle(weapon.accent)}
                  aria-selected={selected}
                  aria-disabled={!available}
                  aria-label={`${weapon.name}, ${catalogSubtitle}, ${weaponCategoryLabel(
                    weapon.category,
                  )}, ${accessibleStatus}`}
                  title={`${catalogSubtitle}. ${weapon.description}`}
                  onClick={() => {
                    if (available) {
                      selectWeaponFromSelector(weapon.id);
                    }
                  }}
                >
                  <span className={styles.weaponOptionLead}>
                    <span
                      className={styles.weaponOptionIcon}
                      aria-hidden="true"
                    >
                      {weapon.icon}
                    </span>
                    <span className={styles.weaponOptionTitle}>
                      <strong>{weapon.shortName}</strong>
                      <span>{catalogSubtitle}</span>
                    </span>
                  </span>
                  <span className={styles.weaponOptionDescription}>
                    {weapon.description}
                  </span>
                  <span className={styles.weaponOptionStatus}>
                    <strong>{status}</strong>
                    <span>
                      {infiniteArsenal ||
                      weapon.ammo.kind === "unlimited"
                        ? "∞"
                        : `× ${ammo}`}
                    </span>
                  </span>
                </button>
              );
            })}
            {selectorExperimental.length > 0 && (
              <>
                <div
                  className={styles.experimentalGroupHeader}
                  role="presentation"
                >
                  <strong>Experimental Ultimates · 10</strong>
                  <span>
                    Только Infinite Arsenal · не входят в canonical 33,
                    магазин и экономику
                  </span>
                </div>
                {selectorExperimental.map((ultimate) => {
                  const selected =
                    activeTank.selectedExperimental === ultimate.id;
                  return (
                    <button
                      type="button"
                      role="option"
                      key={ultimate.id}
                      ref={(node) => {
                        weaponOptionRefs.current[ultimate.id] = node;
                      }}
                      data-weapon-id={ultimate.id}
                      className={`${styles.weaponOption} ${
                        styles.experimentalOption
                      } ${
                        selected ? styles.weaponOptionSelected : ""
                      }`}
                      style={weaponStyle(ultimate.accent)}
                      aria-selected={selected}
                      aria-label={`${ultimate.name}, Experimental Ultimate, ${
                        selected ? "выбрано" : "бесконечный showcase-доступ"
                      }`}
                      title={`${ultimate.description} Strategy: ${ultimate.strategy}.`}
                      onClick={() =>
                        selectExperimentalFromSelector(ultimate.id)
                      }
                    >
                      <span className={styles.weaponOptionLead}>
                        <span
                          className={styles.weaponOptionIcon}
                          aria-hidden="true"
                        >
                          {ultimate.icon}
                        </span>
                        <span className={styles.weaponOptionTitle}>
                          <strong>{ultimate.shortName}</strong>
                          <span>Experimental Ultimate</span>
                        </span>
                      </span>
                      <span className={styles.weaponOptionDescription}>
                        {ultimate.description}
                      </span>
                      <span className={styles.weaponOptionStatus}>
                        <strong>{selected ? "Выбрано" : "Showcase"}</strong>
                        <span>∞</span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </dialog>

      <dialog
        id="shield-selector-dialog"
        ref={shieldDialogRef}
        className={`${styles.weaponDialog} ${styles.shieldDialog}`}
        aria-labelledby="shield-selector-title"
        onCancel={(event) => {
          event.preventDefault();
          closeShieldSelector();
        }}
        onClose={() => {
          setShieldSelectorOpen(false);
          const outcome = shieldCloseOutcomeRef.current;
          shieldCloseOutcomeRef.current = null;
          if (outcome) {
            focusAfterShieldSelectorClose(outcome);
            playUiAudio("selector-close");
          }
        }}
      >
        <div
          className={`${styles.weaponDialogShell} ${styles.shieldDialogShell}`}
        >
          <header className={styles.weaponDialogHeader}>
            <div>
              <p className={styles.weaponDialogEyebrow}>Shield Bay</p>
              <h2 id="shield-selector-title">Щит текущего пилота</h2>
              <p>
                5 защитных семейств + None · выбор и заряд независимы для
                каждого игрока
              </p>
            </div>
            <button
              type="button"
              className={styles.weaponDialogClose}
              onClick={() => closeShieldSelector()}
              aria-label="Закрыть каталог щитов"
            >
              ×
            </button>
          </header>

          <div
            className={`${styles.weaponGrid} ${styles.shieldGrid}`}
            role="listbox"
            aria-label="Каталог щитов"
            onKeyDown={handleShieldGridKeyDown}
          >
            {SHIELDS.map((shield) => {
              const selected = activeTank.shieldId === shield.id;
              const capacity = shieldCapacity(
                shield.id,
                activeTank.reserveShield,
              );
              return (
                <button
                  type="button"
                  role="option"
                  key={shield.id}
                  ref={(node) => {
                    shieldOptionRefs.current[shield.id] = node;
                  }}
                  data-shield-id={shield.id}
                  className={`${styles.weaponOption} ${
                    styles.shieldOption
                  } ${selected ? styles.weaponOptionSelected : ""}`}
                  style={shieldStyle(shield.accent)}
                  aria-selected={selected}
                  aria-label={`${shield.name}, ${
                    shield.confirmedRole
                  }, demo-заряд ${capacity}${
                    selected ? ", выбрано" : ""
                  }`}
                  title={shield.description}
                  onClick={() => selectShieldFromSelector(shield.id)}
                >
                  <span className={styles.weaponOptionLead}>
                    <span
                      className={`${styles.weaponOptionIcon} ${styles.shieldOptionIcon}`}
                      aria-hidden="true"
                    >
                      {shield.icon}
                    </span>
                    <span className={styles.weaponOptionTitle}>
                      <strong>{shield.name}</strong>
                      <span>{shield.confirmedRole}</span>
                    </span>
                  </span>
                  <span className={styles.weaponOptionDescription}>
                    {shield.description}
                  </span>
                  <span className={styles.weaponOptionStatus}>
                    <strong>{selected ? "Выбрано" : "Выбрать"}</strong>
                    <span>заряд {capacity}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </dialog>

      {model.phase === "intro" && (
        <div className={styles.overlay}>
          <section className={styles.modal} aria-labelledby="intro-title">
            <div className={styles.modalMark} aria-hidden="true">
              ⌁
            </div>
            <p className={styles.eyebrow}>Local hot-seat · 3 раунда</p>
            <h2 id="intro-title" className={styles.modalTitle}>
              Огонь оставляет след
            </h2>
            <p className={styles.modalText}>
              Два пилота по очереди на одном экране. Настройте угол и силу,
              учтите ветер и выберите правила доступности арсенала перед
              стартом.
            </p>
            <div
              className={styles.modeGrid}
              aria-label="Режим матча"
            >
              <button
                type="button"
                className={`${styles.modeButton} ${
                  !infiniteArsenal ? styles.modeButtonActive : ""
                }`}
                aria-pressed={!infiniteArsenal}
                onClick={() => selectMatchMode("quick-demo")}
              >
                <strong>Quick Demo</strong>
                <span>
                  Finite ammo расходуется, между раундами работает магазин.
                </span>
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${
                  infiniteArsenal ? styles.modeButtonActive : ""
                }`}
                aria-pressed={infiniteArsenal}
                onClick={() => selectMatchMode("infinite-arsenal")}
              >
                <strong>Infinite Arsenal</strong>
                <span>
                  Неканонический showcase: canonical 33 и отдельные
                  Experimental 10 бесконечны, без магазина.
                </span>
              </button>
            </div>
            {audioSettings}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
                onClick={() => void startMatch()}
              >
                {infiniteArsenal
                  ? "Начать Infinite Arsenal"
                  : "Начать Quick Demo"}
              </button>
            </div>
            <p className={styles.modalText}>
              На клавиатуре: стрелки, Q/E, пробел. На телефоне — крупные
              кнопки и слайдеры.
            </p>
            <p className={styles.disclosure}>
              {infiniteArsenal
                ? "Infinite Arsenal — демонстрационный неканонический режим; механика выстрела не меняется, отключены только расход ammo и магазин."
                : DEMO_PAYOUT_DISCLOSURE}
            </p>
          </section>
        </div>
      )}

      {model.paused && (
        <div className={styles.overlay}>
          <section className={styles.modal} aria-labelledby="pause-title">
            <p className={styles.eyebrow}>Симуляция остановлена</p>
            <h2 id="pause-title" className={styles.modalTitle}>
              Пауза
            </h2>
            {audioSettings}
            <div className={styles.toggleGrid}>
              <button
                type="button"
                className={styles.toggleButton}
                onClick={toggleMotion}
              >
                <span>Reduced motion</span>
                <span className={styles.toggleState}>
                  {model.reducedMotion ? "Вкл" : "Выкл"}
                </span>
              </button>
              <button
                type="button"
                className={styles.toggleButton}
                onClick={cycleEffects}
              >
                <span>Эффекты</span>
                <span className={styles.toggleState}>
                  {model.effectLevel === "full"
                    ? "Полные"
                    : model.effectLevel === "balanced"
                      ? "Баланс"
                      : "Меньше"}
                </span>
              </button>
              <button
                type="button"
                className={styles.toggleButton}
                onClick={resetGame}
              >
                <span>Новый seed</span>
                <span className={styles.toggleState}>Сбросить</span>
              </button>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
                onClick={togglePause}
              >
                Продолжить
              </button>
            </div>
          </section>
        </div>
      )}

      {model.phase === "roundEnd" && (
        <div className={styles.overlay}>
          <section className={styles.modal} aria-labelledby="round-title">
            <div className={styles.modalMark} aria-hidden="true">
              {model.lastRoundWasDraw ? "≈" : "✦"}
            </div>
            <p className={styles.eyebrow}>Раунд {model.round} завершён</p>
            <h2 id="round-title" className={styles.modalTitle}>
              {model.lastRoundWasDraw
                ? "Паритет"
                : `${model.tanks[model.roundWinner as 0 | 1].name} побеждает`}
            </h2>
            <p className={styles.modalText}>
              {infiniteArsenal
                ? "Showcase сохраняет результат раунда, но пропускает экономику и сразу продолжает с бесконечным арсеналом."
                : "Оба пилота получили награду за нанесённый урон. Победителю начислен дополнительный бонус."}
            </p>
            {!infiniteArsenal && (
              <p className={styles.disclosure}>
                {DEMO_PAYOUT_DISCLOSURE}
              </p>
            )}
            <div className={styles.scoreGrid}>
              {model.tanks.map((tank) => (
                <div
                  key={tank.id}
                  className={styles.scoreCard}
                  style={playerStyle(tank.color)}
                >
                  <div className={styles.scoreName}>{tank.name}</div>
                  <div className={styles.scoreWins}>{tank.wins}</div>
                  <div className={styles.summaryRow}>
                    <span>побед</span>
                    <span>₡ {formatCredits(tank.credits)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
                onClick={openRoundResult}
              >
                {model.round >= TOTAL_ROUNDS
                  ? "Итоги матча"
                  : infiniteArsenal
                    ? "Следующий showcase-раунд"
                    : "В магазин"}
              </button>
            </div>
          </section>
        </div>
      )}

      {model.phase === "shop" && (
        <div className={styles.overlay}>
          <section
            className={`${styles.modal} ${styles.modalWide}`}
            aria-labelledby="shop-title"
          >
            <div className={styles.shopHeader}>
              <div
                className={styles.shopPlayerLine}
                style={playerStyle(model.tanks[model.shopPlayer].color)}
              >
                <span className={styles.playerDot} aria-hidden="true" />
                <span>{model.tanks[model.shopPlayer].name}</span>
              </div>
              <div>
                <p className={styles.eyebrow}>Перед раундом {model.round + 1}</p>
                <h2 id="shop-title" className={styles.modalTitle}>
                  Арсенал
                </h2>
              </div>
              <div className={styles.shopPlayerLine}>
                <span className={styles.money}>
                  ₡ {formatCredits(shopTank.credits)}
                </span>
              </div>
            </div>

            <div className={styles.shopEconomy} aria-label="Экономика магазина">
              <span>
                Стартовый банк ₡ {formatCredits(shopTank.bankAtRoundStart)}
              </span>
              <span>
                Процент {Math.round(CLASSIC_INTEREST_RATE * 100)}% при старте
                раунда: <strong>+₡ {formatCredits(interestPreview)}</strong>
              </span>
              <span>
                Последнее начисление +₡ {formatCredits(shopTank.lastInterest)}
              </span>
              <span>Лимит одного weapon: {MAX_INVENTORY}</span>
            </div>
            <p className={styles.shopDisclosure}>
              {DEMO_PAYOUT_DISCLOSURE} Продажа по одной единице использует
              отдельный demo sell-back 60%; выручка остаётся на текущем балансе
              и также входит в показанные 5% процентов.
            </p>

            <div
              className={styles.arsenalTabs}
              role="tablist"
              aria-label="Фильтр арсенала"
            >
              {WEAPON_SELECTOR_FILTERS.filter(
                (filter) => filter.id !== "experimental",
              ).map((filter) => (
                <button
                  type="button"
                  key={filter.id}
                  className={`${styles.arsenalTab} ${
                    arsenalFilter === filter.id
                      ? styles.arsenalTabActive
                      : ""
                  }`}
                  role="tab"
                  aria-selected={arsenalFilter === filter.id}
                  onClick={() => setArsenalFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className={styles.shopGrid}>
              {filteredWeapons.map((weapon) => {
                const purchaseQuote = quoteWeaponPurchase(
                  weapon.id,
                  shopTank.inventory,
                );
                const saleQuote = quoteWeaponSale(
                  weapon.id,
                  shopTank.inventory,
                  1,
                );
                const currentAmmo =
                  weapon.ammo.kind === "unlimited"
                    ? Number.POSITIVE_INFINITY
                    : weaponAmmo(shopTank, weapon.id);
                const canBuy =
                  purchaseQuote.kind === "available" &&
                  shopTank.credits >= purchaseQuote.price;
                const canSell = saleQuote.kind === "available";
                const displayPrice =
                  purchaseQuote.kind === "available"
                    ? purchaseQuote.price
                    : weapon.catalogPrice;
                const purchaseActionText =
                  weapon.ammo.kind === "unlimited"
                    ? "Базовый ∞"
                    : canBuy
                      ? `Купить +${purchaseQuote.kind === "available" ? purchaseQuote.quantity : 0}`
                      : purchaseQuote.kind === "unavailable"
                        ? `Лимит ${MAX_INVENTORY}`
                        : "Не хватает ₡";
                const saleActionText = canSell
                  ? `Продать 1 · ₡${formatCredits(saleQuote.proceeds)}`
                  : "Продажа —";
                return (
                  <article
                    key={weapon.id}
                    className={styles.shopCard}
                    style={weaponStyle(weapon.accent)}
                  >
                    <div className={styles.shopCardLead}>
                      <span className={styles.weaponIcon} aria-hidden="true">
                        {weapon.icon}
                      </span>
                      <span>
                        <span className={styles.shopCardTitle}>
                          {weapon.name}
                        </span>
                        <span className={styles.shopCardFamily}>
                          {weaponCatalogSubtitle(weapon)}
                        </span>
                      </span>
                    </div>
                    <span className={styles.shopCardDescription}>
                      {weapon.description}
                    </span>
                    <span className={styles.shopFacts}>
                      <span>Arms {weapon.armsLevel}</span>
                      <span>BR {formatBlastRadius(weapon.blastRadius)}</span>
                      <span>Bundle ×{weapon.catalogBundleSize}</span>
                      <span>
                        Ammo{" "}
                        {weapon.ammo.kind === "unlimited"
                          ? "∞"
                          : `${currentAmmo}/${MAX_INVENTORY}`}
                      </span>
                    </span>
                    <span className={styles.shopCardMeta}>
                      <span>₡ {formatCredits(displayPrice)}</span>
                      <span>
                        {purchaseQuote.kind === "available"
                          ? `+${purchaseQuote.quantity}`
                          : "всегда ∞"}
                      </span>
                    </span>
                    {purchaseQuote.kind === "available" &&
                      purchaseQuote.isPartialBundle && (
                        <span className={styles.partialBundle}>
                          Частичный bundle у лимита: +20%
                        </span>
                      )}
                    <div className={styles.shopCardActions}>
                      <button
                        type="button"
                        className={styles.shopAction}
                        disabled={!canBuy}
                        onClick={() => buyWeapon(weapon.id)}
                        aria-label={`${weapon.name}: ${purchaseActionText}`}
                      >
                        {purchaseActionText}
                      </button>
                      <button
                        type="button"
                        className={`${styles.shopAction} ${styles.shopActionSell}`}
                        disabled={!canSell}
                        onClick={() => sellOneWeapon(weapon.id)}
                        aria-label={`${weapon.name}: ${saleActionText}`}
                      >
                        {saleActionText}
                      </button>
                    </div>
                  </article>
                );
              })}

              {arsenalFilter === "all" && (
                <>
                  <button
                    type="button"
                    className={styles.shopCard}
                    style={weaponStyle("#d8ff45")}
                    disabled={
                      model.tanks[model.shopPlayer].credits < 3_000 ||
                      model.tanks[model.shopPlayer].bonusHealth >= 40
                    }
                    onClick={() => buyUpgrade("health")}
                  >
                    <span className={styles.weaponIcon} aria-hidden="true">
                      ⬡
                    </span>
                    <span className={styles.shopCardTitle}>
                      Усиление корпуса
                    </span>
                    <span className={styles.shopCardDescription}>
                      +20 к состоянию машины на следующий раунд.
                    </span>
                    <span className={styles.shopCardMeta}>
                      <span>₡ 3 000</span>
                      <span>+20 HP</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={styles.shopCard}
                    style={weaponStyle("#68e5ef")}
                    disabled={
                      model.tanks[model.shopPlayer].credits < 4_500 ||
                      model.tanks[model.shopPlayer].reserveShield >= 60
                    }
                    onClick={() => buyUpgrade("shield")}
                  >
                    <span className={styles.weaponIcon} aria-hidden="true">
                      ◉
                    </span>
                    <span className={styles.shopCardTitle}>Фазовый щит</span>
                    <span className={styles.shopCardDescription}>
                      +25 защиты перед началом следующего раунда.
                    </span>
                    <span className={styles.shopCardMeta}>
                      <span>₡ 4 500</span>
                      <span>+25 щит</span>
                    </span>
                  </button>
                </>
              )}
            </div>

            <div className={`${styles.modalActions} ${styles.shopDone}`}>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
                onClick={finishShopping}
              >
                {model.shopPlayer === 0 ? "Передать второму" : "Начать раунд"}
              </button>
            </div>
          </section>
        </div>
      )}

      {model.phase === "matchEnd" && (
        <div className={styles.overlay}>
          <section className={styles.modal} aria-labelledby="match-title">
            <div className={styles.modalMark} aria-hidden="true">
              ✺
            </div>
            <p className={styles.eyebrow}>
              {infiniteArsenal
                ? "Infinite Arsenal завершён"
                : "Quick Match завершён"}
            </p>
            <h2 id="match-title" className={styles.modalTitle}>
              {winner ? `${winner.name} — победитель` : "Матч окончен вничью"}
            </h2>
            <div className={styles.scoreGrid}>
              {model.tanks.map((tank) => (
                <div
                  key={tank.id}
                  className={styles.scoreCard}
                  style={playerStyle(tank.color)}
                >
                  <div className={styles.scoreName}>{tank.name}</div>
                  <div className={styles.scoreWins}>{tank.wins}</div>
                  <div className={styles.summaryRow}>
                    <span>раундов</span>
                    <span>₡ {formatCredits(tank.credits)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
                onClick={resetGame}
              >
                Новый матч
              </button>
            </div>
          </section>
        </div>
      )}

      <span className={styles.srOnly} aria-live="assertive">
        {model.phase === "firing"
          ? `Выстрел: ${selectedPlayable.name}`
          : ""}
      </span>
    </div>
  );
}
