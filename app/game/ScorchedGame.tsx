"use client";

import {
  Material,
  SeededRandom,
  TerrainGrid,
  WEAPONS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  generateTerrain,
  simulateTrajectory,
  type Tank,
  type TrajectoryPoint,
  type Vector2,
  type WeaponId,
} from "@/lib/game";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import styles from "./ScorchedGame.module.css";

const TOTAL_ROUNDS = 3;
const MAX_TURNS_PER_ROUND = 12;
const TANK_HALF_HEIGHT = 11;

const PLAYER_COLORS = ["#d8ff45", "#ff6658"] as const;
const PLAYER_NAMES = ["Пилот Лайм", "Пилот Коралл"] as const;

const WEAPON_COPY: Record<
  WeaponId,
  { readonly name: string; readonly short: string; readonly icon: string }
> = {
  shell: { name: "Звёздный снаряд", short: "Снаряд", icon: "◆" },
  mirv: { name: "Призма MIRV", short: "MIRV", icon: "✦" },
  roller: { name: "Комета-роллер", short: "Роллер", icon: "●" },
  digger: { name: "Глубинный бур", short: "Бур", icon: "⟱" },
  napalm: { name: "Солнечный гель", short: "Гель", icon: "⌁" },
  dirtBloom: { name: "Земляной цветок", short: "Цветок", icon: "✺" },
};

const WEAPON_DESCRIPTION: Record<WeaponId, string> = {
  shell: "Надёжный взрыв по баллистической дуге.",
  mirv: "В апогее раскрывается веером из пяти зарядов.",
  roller: "Катится по склону к низине перед взрывом.",
  digger: "Проникает под землю и обходит щит снизу.",
  napalm: "Растекается по поверхности горящими лентами.",
  dirtBloom: "Создаёт твёрдое укрытие вместо воронки.",
};

const SHOT_STATUS: Record<WeaponId, string> = {
  shell: "Чистая траектория. Ударная волна готова.",
  mirv: "Призма набирает высоту для раскрытия.",
  roller: "Комета ищет низину по форме рельефа.",
  digger: "Бур сканирует плотность под поверхностью.",
  napalm: "Солнечный гель прогрет до текучего состояния.",
  dirtBloom: "Семя грунта готово к кристаллизации.",
};

type GamePhase =
  | "intro"
  | "aiming"
  | "firing"
  | "roundEnd"
  | "shop"
  | "matchEnd";

type EffectLevel = "full" | "balanced" | "reduced";

interface PlayerTank extends Tank {
  color: string;
  shield: number;
  maxShield: number;
  wins: number;
  damageDealt: number;
  bonusHealth: number;
  reserveShield: number;
}

interface GameModel {
  seed: number;
  phase: GamePhase;
  round: number;
  activePlayer: 0 | 1;
  shopPlayer: 0 | 1;
  terrain: TerrainGrid;
  terrainRevision: number;
  wind: number;
  turn: number;
  tanks: [PlayerTank, PlayerTank];
  selectedWeapons: [WeaponId, WeaponId];
  roundWinner: 0 | 1 | null;
  lastRoundWasDraw: boolean;
  paused: boolean;
  audioEnabled: boolean;
  reducedMotion: boolean;
  effectLevel: EffectLevel;
  message: string;
}

type SegmentStyle =
  | "shell"
  | "mirv-parent"
  | "mirv-child"
  | "roller"
  | "digger"
  | "napalm"
  | "dirt";

interface FlightSegment {
  path: readonly Vector2[];
  startsAt: number;
  endsAt: number;
  style: SegmentStyle;
}

interface ShotVisual {
  weaponId: WeaponId;
  owner: 0 | 1;
  elapsedMs: number;
  duration: number;
  resolvedAt: number;
  endsAt: number;
  resolved: boolean;
  completed: boolean;
  segments: FlightSegment[];
  impactPoints: Vector2[];
  finalPoint: Vector2;
  flowPoints: Vector2[];
  seed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  drag: number;
  gravity: number;
  kind: "spark" | "smoke" | "ember" | "soil" | "prism";
}

interface TerrainCache {
  canvas: HTMLCanvasElement;
  revision: number;
}

interface AudioEngine {
  context: AudioContext;
  master: GainNode;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const distance = (a: Vector2, b: Vector2) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const formatCredits = (credits: number) =>
  new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.round(credits)));

function pathPoint(path: readonly Vector2[], progress: number): Vector2 {
  if (path.length === 0) {
    return { x: 0, y: 0 };
  }

  if (path.length === 1) {
    return path[0] as Vector2;
  }

  const exactIndex = clamp(progress, 0, 1) * (path.length - 1);
  const low = Math.floor(exactIndex);
  const high = Math.min(path.length - 1, low + 1);
  const local = exactIndex - low;
  const start = path[low] as Vector2;
  const end = path[high] as Vector2;

  return {
    x: lerp(start.x, end.x, local),
    y: lerp(start.y, end.y, local),
  };
}

function samplePath(
  points: readonly Vector2[],
  maxPoints = 150,
): readonly Vector2[] {
  if (points.length <= maxPoints) {
    return points;
  }

  const sampled: Vector2[] = [];
  const stride = (points.length - 1) / (maxPoints - 1);

  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round(index * stride)] as Vector2);
  }

  return sampled;
}

function surfaceForTank(terrain: TerrainGrid, x: number): number {
  return terrain.surfaceY(x) ?? WORLD_HEIGHT - 26;
}

function tankY(terrain: TerrainGrid, x: number): number {
  return surfaceForTank(terrain, x) - TANK_HALF_HEIGHT;
}

function initialInventory(): Partial<Record<WeaponId, number>> {
  return {
    mirv: 1,
    roller: 1,
    digger: 1,
    napalm: 1,
    dirtBloom: 1,
  };
}

function makePlayer(
  index: 0 | 1,
  terrain: TerrainGrid,
): PlayerTank {
  const x = index === 0 ? 155 : WORLD_WIDTH - 155;

  return {
    id: `player-${index + 1}`,
    name: PLAYER_NAMES[index],
    x,
    y: tankY(terrain, x),
    direction: index === 0 ? 1 : -1,
    angleDegrees: 48,
    power: 400,
    health: 100,
    maxHealth: 100,
    credits: 8_000,
    inventory: initialInventory(),
    color: PLAYER_COLORS[index],
    shield: 24,
    maxShield: 24,
    wins: 0,
    damageDealt: 0,
    bonusHealth: 0,
    reserveShield: 0,
  };
}

function nextWind(seed: number, round: number): number {
  const random = new SeededRandom(`${seed}:wind:${round}`);
  const raw = random.integer(-90, 91);
  return Math.abs(raw) < 12 ? (raw < 0 ? -12 : 12) : raw;
}

function createGame(seed = 41_705): GameModel {
  const terrain = generateTerrain(seed, {
    minSurfaceY: 245,
    maxSurfaceY: 370,
    roughness: 56,
    caveCount: 5,
    bedrockDepth: 46,
  });

  return {
    seed,
    phase: "intro",
    round: 1,
    activePlayer: 0,
    shopPlayer: 0,
    terrain,
    terrainRevision: 0,
    wind: nextWind(seed, 1),
    turn: 0,
    tanks: [makePlayer(0, terrain), makePlayer(1, terrain)],
    selectedWeapons: ["shell", "shell"],
    roundWinner: null,
    lastRoundWasDraw: false,
    paused: false,
    audioEnabled: true,
    reducedMotion: false,
    effectLevel: "full",
    message: "Настройте угол и силу. Первый выстрел за пилотом Лайм.",
  };
}

function weaponAmmo(tank: PlayerTank, weaponId: WeaponId): number {
  if (weaponId === "shell") {
    return Number.POSITIVE_INFINITY;
  }

  return tank.inventory[weaponId] ?? 0;
}

function canUseWeapon(tank: PlayerTank, weaponId: WeaponId): boolean {
  return weaponId === "shell" || weaponAmmo(tank, weaponId) > 0;
}

function projectileOrigin(tank: PlayerTank): Vector2 {
  const radians = (tank.angleDegrees * Math.PI) / 180;
  return {
    x: tank.x + Math.cos(radians) * tank.direction * 24,
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

function buildRollPath(
  terrain: TerrainGrid,
  impact: Vector2,
): readonly Vector2[] {
  const leftSurface = surfaceForTank(terrain, impact.x - 8);
  const rightSurface = surfaceForTank(terrain, impact.x + 8);
  let direction = rightSurface >= leftSurface ? 1 : -1;
  let x = clamp(impact.x, 3, WORLD_WIDTH - 3);
  let previousY = surfaceForTank(terrain, x) - 4;
  const points: Vector2[] = [{ x, y: previousY }];

  for (let step = 0; step < 55; step += 1) {
    const candidateX = clamp(x + direction * 3.2, 3, WORLD_WIDTH - 3);
    const candidateY = surfaceForTank(terrain, candidateX) - 4;

    if (candidateY < previousY - 7) {
      direction = direction === 1 ? -1 : 1;
      continue;
    }

    x = candidateX;
    previousY = candidateY;
    points.push({ x, y: candidateY });

    const aheadY =
      surfaceForTank(terrain, clamp(x + direction * 6, 2, WORLD_WIDTH - 2)) -
      4;
    if (Math.abs(aheadY - candidateY) < 1 && step > 20) {
      break;
    }
  }

  return points;
}

function buildDiggerPath(
  terrain: TerrainGrid,
  impact: Vector2,
  velocity: Vector2,
): readonly Vector2[] {
  const length = Math.max(1, Math.hypot(velocity.x, velocity.y));
  const directionX = velocity.x / length;
  const directionY = Math.max(0.35, Math.abs(velocity.y / length));
  const points: Vector2[] = [{ ...impact }];
  let x = impact.x;
  let y = impact.y;

  for (let step = 0; step < 62; step += 1) {
    x = clamp(x + directionX * 2.25, 4, terrain.width - 4);
    y = clamp(y + directionY * 2.25, 4, terrain.height - 5);
    points.push({ x, y });
  }

  return points;
}

function buildFlowPoints(
  terrain: TerrainGrid,
  impact: Vector2,
): readonly Vector2[] {
  const points: Vector2[] = [];
  for (let offset = -96; offset <= 96; offset += 12) {
    const x = clamp(impact.x + offset, 3, terrain.width - 3);
    points.push({ x, y: surfaceForTank(terrain, x) - 3 });
  }
  return points;
}

function buildShot(
  model: GameModel,
  weaponId: WeaponId,
): ShotVisual {
  const owner = model.activePlayer;
  const tank = model.tanks[owner];
  const trajectory = ballisticPath(model, tank);
  const basePath = samplePath(trajectory);
  const impact =
    basePath[basePath.length - 1] ?? projectileOrigin(tank);
  const reduced = model.reducedMotion;
  const durationScale = reduced ? 0.7 : 1;
  const segments: FlightSegment[] = [];
  const impactPoints: Vector2[] = [];
  let finalPoint = impact;
  let flowPoints: readonly Vector2[] = [];
  let resolvedAt = 0.62;
  let endsAt = 0.94;
  let duration = 2_900 * durationScale;

  if (weaponId === "shell") {
    segments.push({
      path: basePath,
      startsAt: 0.08,
      endsAt: 0.57,
      style: "shell",
    });
    impactPoints.push(impact);
    resolvedAt = 0.59;
    duration = 2_350 * durationScale;
  }

  if (weaponId === "mirv") {
    let apexIndex = 1;
    for (let index = 2; index < trajectory.length - 2; index += 1) {
      if (
        (trajectory[index] as TrajectoryPoint).y <
        (trajectory[apexIndex] as TrajectoryPoint).y
      ) {
        apexIndex = index;
      }
    }

    apexIndex = clamp(
      apexIndex,
      Math.floor(trajectory.length * 0.25),
      Math.floor(trajectory.length * 0.68),
    );
    const apex = trajectory[apexIndex] as TrajectoryPoint;
    const parentPath = samplePath(trajectory.slice(0, apexIndex + 1), 80);
    segments.push({
      path: parentPath,
      startsAt: 0.06,
      endsAt: 0.42,
      style: "mirv-parent",
    });

    const baseSpeed =
      Math.hypot(apex.velocityX, apex.velocityY) / 0.75;
    const baseAngle = clamp(
      (Math.atan2(-apex.velocityY, Math.abs(apex.velocityX)) * 180) / Math.PI,
      8,
      82,
    );
    const baseDirection = apex.velocityX >= 0 ? 1 : -1;
    const spread = [-18, -9, 0, 9, 18] as const;

    spread.forEach((offset) => {
      const child = simulateTrajectory(model.terrain, {
        origin: { x: apex.x, y: apex.y },
        angleDegrees: clamp(baseAngle + offset, 4, 88),
        power: Math.max(250, baseSpeed * (1 + offset * 0.004)),
        direction: baseDirection,
        wind: model.wind,
        projectileRadius: 1.5,
        maxTime: 7,
      }).points;
      const childPath = samplePath(child, 100);
      const childImpact =
        childPath[childPath.length - 1] ?? { x: apex.x, y: apex.y };
      segments.push({
        path: childPath,
        startsAt: 0.43,
        endsAt: 0.77,
        style: "mirv-child",
      });
      impactPoints.push(childImpact);
    });

    finalPoint = impactPoints[2] ?? impact;
    resolvedAt = 0.79;
    endsAt = 0.97;
    duration = 3_400 * durationScale;
  }

  if (weaponId === "roller") {
    const rollPath = buildRollPath(model.terrain, impact);
    segments.push(
      {
        path: basePath,
        startsAt: 0.07,
        endsAt: 0.43,
        style: "roller",
      },
      {
        path: rollPath,
        startsAt: 0.44,
        endsAt: 0.73,
        style: "roller",
      },
    );
    finalPoint = rollPath[rollPath.length - 1] ?? impact;
    impactPoints.push(finalPoint);
    resolvedAt = 0.75;
    duration = 3_050 * durationScale;
  }

  if (weaponId === "digger") {
    const lastTrajectoryPoint =
      trajectory[trajectory.length - 1] ??
      ({ velocityX: tank.direction, velocityY: 1 } as TrajectoryPoint);
    const tunnelPath = buildDiggerPath(model.terrain, impact, {
      x: lastTrajectoryPoint.velocityX,
      y: lastTrajectoryPoint.velocityY,
    });
    segments.push(
      {
        path: basePath,
        startsAt: 0.07,
        endsAt: 0.38,
        style: "digger",
      },
      {
        path: tunnelPath,
        startsAt: 0.39,
        endsAt: 0.76,
        style: "digger",
      },
    );
    finalPoint = tunnelPath[tunnelPath.length - 1] ?? impact;
    impactPoints.push(finalPoint);
    resolvedAt = 0.77;
    duration = 3_200 * durationScale;
  }

  if (weaponId === "napalm") {
    segments.push({
      path: basePath,
      startsAt: 0.06,
      endsAt: 0.5,
      style: "napalm",
    });
    flowPoints = buildFlowPoints(model.terrain, impact);
    impactPoints.push(impact);
    finalPoint = impact;
    resolvedAt = 0.55;
    endsAt = 0.98;
    duration = 3_650 * durationScale;
  }

  if (weaponId === "dirtBloom") {
    segments.push({
      path: basePath,
      startsAt: 0.07,
      endsAt: 0.54,
      style: "dirt",
    });
    impactPoints.push(impact);
    resolvedAt = 0.58;
    endsAt = 0.96;
    duration = 3_000 * durationScale;
  }

  return {
    weaponId,
    owner,
    elapsedMs: 0,
    duration,
    resolvedAt,
    endsAt,
    resolved: false,
    completed: false,
    segments,
    impactPoints,
    finalPoint,
    flowPoints: [...flowPoints],
    seed: model.seed + model.round * 1_003 + model.turn * 37,
  };
}

function applyDamage(
  model: GameModel,
  tank: PlayerTank,
  rawDamage: number,
  shieldBypass = 0,
): number {
  const damage = Math.max(0, rawDamage);
  const directDamage = damage * shieldBypass;
  const shieldable = damage - directDamage;
  const absorbed = Math.min(tank.shield, shieldable);
  tank.shield -= absorbed;
  const healthDamage = Math.max(0, directDamage + shieldable - absorbed);
  tank.health = Math.max(0, tank.health - healthDamage);
  const healthPowerLimit = Math.max(
    260,
    Math.round(1_000 * (tank.health / tank.maxHealth)),
  );
  tank.power = Math.min(tank.power, healthPowerLimit);
  const attacker = model.tanks[model.activePlayer];
  if (attacker.id !== tank.id) {
    attacker.damageDealt += healthDamage + absorbed * 0.35;
  }
  return healthDamage;
}

function explosionDamage(
  model: GameModel,
  center: Vector2,
  radius: number,
  peakDamage: number,
  shieldBypass = 0,
): void {
  for (const tank of model.tanks) {
    const tankCenter = { x: tank.x, y: tank.y - 5 };
    const reach = radius + 18;
    const proximity = distance(center, tankCenter);
    if (proximity > reach) {
      continue;
    }
    const falloff = 1 - proximity / reach;
    applyDamage(model, tank, peakDamage * (0.22 + falloff * 0.78), shieldBypass);
  }
}

function settleTanks(model: GameModel, allowFallDamage = true): void {
  for (const tank of model.tanks) {
    const previousY = tank.y;
    const surface = model.terrain.surfaceY(tank.x);

    if (surface === null) {
      tank.health = 0;
      tank.y = WORLD_HEIGHT + 30;
      continue;
    }

    tank.y = surface - TANK_HALF_HEIGHT;
    const fall = tank.y - previousY;
    if (allowFallDamage && fall > 54) {
      applyDamage(model, tank, Math.min(36, (fall - 42) * 0.42));
    }
  }
}

function resolveWeapon(model: GameModel, shot: ShotVisual): void {
  if (shot.weaponId === "shell") {
    const point = shot.finalPoint;
    model.terrain.carveCircle(point.x, point.y, 24);
    explosionDamage(model, point, 25, 48);
  }

  if (shot.weaponId === "mirv") {
    shot.impactPoints.forEach((point) => {
      model.terrain.carveCircle(point.x, point.y, 17);
      explosionDamage(model, point, 18, 29);
    });
  }

  if (shot.weaponId === "roller") {
    model.terrain.carveCircle(shot.finalPoint.x, shot.finalPoint.y, 31);
    explosionDamage(model, shot.finalPoint, 34, 63);
  }

  if (shot.weaponId === "digger") {
    const tunnel =
      shot.segments.find(
        (segment) =>
          segment.style === "digger" && segment.startsAt > 0.38,
      )?.path ?? [];
    for (let index = 0; index < tunnel.length; index += 4) {
      const point = tunnel[index] as Vector2;
      model.terrain.carveCircle(point.x, point.y, 5);
    }
    model.terrain.carveCircle(shot.finalPoint.x, shot.finalPoint.y, 25);
    explosionDamage(model, shot.finalPoint, 30, 58, 0.7);
  }

  if (shot.weaponId === "napalm") {
    shot.flowPoints.forEach((point, index) => {
      if (index % 2 === 0) {
        model.terrain.carveCircle(point.x, point.y + 2, 6);
      }
    });

    for (const tank of model.tanks) {
      const closest = shot.flowPoints.reduce(
        (best, point) =>
          Math.min(best, Math.hypot(tank.x - point.x, tank.y - point.y)),
        Number.POSITIVE_INFINITY,
      );
      if (closest < 54) {
        applyDamage(model, tank, 62 * (1 - closest / 76));
      }
    }
  }

  if (shot.weaponId === "dirtBloom") {
    model.terrain.fillCircle(
      shot.finalPoint.x,
      shot.finalPoint.y - 10,
      39,
      Material.Soil,
    );
  }

  model.terrainRevision += 1;
  settleTanks(model, shot.weaponId !== "dirtBloom");
}

function chooseAvailableWeapon(
  model: GameModel,
  player: 0 | 1,
): WeaponId {
  const chosen = model.selectedWeapons[player];
  return canUseWeapon(model.tanks[player], chosen) ? chosen : "shell";
}

function shotOutcomeText(model: GameModel): string {
  const player = model.tanks[model.activePlayer];
  const opponent = model.tanks[model.activePlayer === 0 ? 1 : 0];

  if (opponent.health <= 0 && player.health <= 0) {
    return "Двойное уничтожение. Раунд завершён вничью.";
  }
  if (opponent.health <= 0) {
    return `${player.name} выводит соперника из строя.`;
  }
  if (player.health <= 0) {
    return `${player.name} попадает под собственный удар.`;
  }

  return `Рельеф стабилен. Ход переходит сопернику.`;
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

  model.tanks.forEach((tank, index) => {
    tank.credits +=
      7_000 +
      Math.round(tank.damageDealt * 55) +
      (winner === index ? 2_500 : 0);
  });

  model.phase = "roundEnd";
  model.message = draw
    ? `Раунд ${model.round}: ничья по состоянию машин.`
    : `${model.tanks[winner as 0 | 1].name} выигрывает раунд ${model.round}.`;
}

function prepareNextRound(model: GameModel): void {
  model.round += 1;
  model.turn = 0;
  model.activePlayer = model.round % 2 === 0 ? 1 : 0;
  model.terrain = generateTerrain(model.seed + model.round * 7_919, {
    minSurfaceY: 245,
    maxSurfaceY: 370,
    roughness: 58,
    caveCount: 5,
    bedrockDepth: 46,
  });
  model.terrainRevision += 1;
  model.wind = nextWind(model.seed, model.round);
  model.roundWinner = null;
  model.lastRoundWasDraw = false;

  model.tanks.forEach((tank, index) => {
    tank.x = index === 0 ? 155 : WORLD_WIDTH - 155;
    tank.y = tankY(model.terrain, tank.x);
    tank.maxHealth = 100 + tank.bonusHealth;
    tank.health = tank.maxHealth;
    tank.maxShield = 20 + tank.reserveShield;
    tank.shield = tank.maxShield;
    tank.bonusHealth = 0;
    tank.reserveShield = 0;
    tank.damageDealt = 0;
    tank.direction = index === 0 ? 1 : -1;
  });

  model.phase = "aiming";
  model.message = `Раунд ${model.round}. Новый рельеф, ветер ${Math.abs(model.wind)}.`;
}

function renderTerrain(
  terrain: TerrainGrid,
  revision: number,
  cacheRef: { current: TerrainCache | null },
): HTMLCanvasElement {
  if (cacheRef.current?.revision === revision) {
    return cacheRef.current.canvas;
  }

  const canvas =
    cacheRef.current?.canvas ?? document.createElement("canvas");
  canvas.width = terrain.width;
  canvas.height = terrain.height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    return canvas;
  }

  const image = context.createImageData(terrain.width, terrain.height);
  const pixels = image.data;

  for (let y = 0; y < terrain.height; y += 1) {
    for (let x = 0; x < terrain.width; x += 1) {
      const material = terrain.cells[y * terrain.width + x] as Material;
      if (material === Material.Empty) {
        continue;
      }

      const offset = (y * terrain.width + x) * 4;
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

  context.putImageData(image, 0, 0);

  context.globalCompositeOperation = "source-atop";
  const soilShade = context.createLinearGradient(0, 230, 0, WORLD_HEIGHT);
  soilShade.addColorStop(0, "rgba(216, 255, 69, 0.32)");
  soilShade.addColorStop(0.06, "rgba(138, 147, 74, 0.10)");
  soilShade.addColorStop(0.5, "rgba(8, 10, 11, 0.14)");
  soilShade.addColorStop(1, "rgba(0, 0, 0, 0.52)");
  context.fillStyle = soilShade;
  context.fillRect(0, 0, terrain.width, terrain.height);
  context.globalCompositeOperation = "source-over";

  cacheRef.current = { canvas, revision };
  return canvas;
}

function drawBackdrop(context: CanvasRenderingContext2D, now: number): void {
  const sky = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#07090a");
  sky.addColorStop(0.58, "#101719");
  sky.addColorStop(1, "#1b1d18");
  context.fillStyle = sky;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  context.save();
  context.globalAlpha = 0.25;
  for (let index = 0; index < 56; index += 1) {
    const x = (index * 173 + 41) % WORLD_WIDTH;
    const y = (index * 71 + 27) % 238;
    const pulse = 0.45 + Math.sin(now * 0.0007 + index) * 0.2;
    context.fillStyle = index % 7 === 0 ? "#68e5ef" : "#f1f3e9";
    context.globalAlpha = pulse;
    context.fillRect(x, y, index % 5 === 0 ? 2 : 1, 1);
  }
  context.restore();

  const glow = context.createRadialGradient(760, 92, 2, 760, 92, 105);
  glow.addColorStop(0, "rgba(216,255,69,0.20)");
  glow.addColorStop(0.22, "rgba(216,255,69,0.08)");
  glow.addColorStop(1, "rgba(216,255,69,0)");
  context.fillStyle = glow;
  context.fillRect(650, 0, 220, 205);

  context.strokeStyle = "rgba(104,229,239,0.045)";
  context.lineWidth = 1;
  for (let x = 0; x <= WORLD_WIDTH; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, WORLD_HEIGHT);
    context.stroke();
  }
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
    x: tank.x + Math.cos(radians) * tank.direction * 25,
    y: tank.y - 8 - Math.sin(radians) * 25,
  };

  context.save();
  if (tank.shield > 0) {
    const shieldPulse = 1 + Math.sin(now * 0.003 + tank.x) * 0.025;
    context.strokeStyle = `rgba(104,229,239,${
      0.28 + (tank.shield / Math.max(1, tank.maxShield)) * 0.25
    })`;
    context.lineWidth = 2;
    context.setLineDash([5, 5]);
    context.beginPath();
    context.ellipse(
      tank.x,
      tank.y - 7,
      28 * shieldPulse,
      23 * shieldPulse,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.setLineDash([]);
  }

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

function segmentColor(style: SegmentStyle): string {
  switch (style) {
    case "shell":
      return "#ffe083";
    case "mirv-parent":
      return "#d38cff";
    case "mirv-child":
      return "#f5a3ff";
    case "roller":
      return "#68e5ef";
    case "digger":
      return "#ff9d57";
    case "napalm":
      return "#ff6658";
    case "dirt":
      return "#d8ff45";
  }
}

function drawProjectile(
  context: CanvasRenderingContext2D,
  segment: FlightSegment,
  progress: number,
  reduced: boolean,
  now: number,
): void {
  const local = clamp(
    (progress - segment.startsAt) / (segment.endsAt - segment.startsAt),
    0,
    1,
  );
  const point = pathPoint(segment.path, local);
  const color = segmentColor(segment.style);
  const trailStart = Math.max(0, local - (reduced ? 0.08 : 0.2));

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.shadowColor = color;
  context.shadowBlur = reduced ? 4 : 13;
  context.globalAlpha = 0.64;
  context.lineWidth =
    segment.style === "napalm" || segment.style === "roller" ? 4 : 2;
  context.beginPath();
  for (let sample = 0; sample <= 12; sample += 1) {
    const trailProgress = lerp(trailStart, local, sample / 12);
    const trailPoint = pathPoint(segment.path, trailProgress);
    if (sample === 0) {
      context.moveTo(trailPoint.x, trailPoint.y);
    } else {
      context.lineTo(trailPoint.x, trailPoint.y);
    }
  }
  context.stroke();

  context.globalAlpha = 1;
  context.fillStyle = color;

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
  } else if (segment.style === "digger" && segment.startsAt > 0.38) {
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
  } else if (segment.style === "mirv-parent") {
    context.translate(point.x, point.y);
    context.rotate(now * 0.005);
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(6, 4);
    context.lineTo(0, 7);
    context.lineTo(-6, 4);
    context.closePath();
    context.fill();
  } else {
    const radius =
      segment.style === "napalm" ? 6 : segment.style === "dirt" ? 6 : 4;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
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
  for (const segment of shot.segments) {
    if (progress >= segment.startsAt && progress <= segment.endsAt) {
      drawProjectile(
        context,
        segment,
        progress,
        model.reducedMotion,
        now,
      );
    }
  }

  if (
    shot.weaponId === "mirv" &&
    progress > 0.39 &&
    progress < 0.5
  ) {
    const splitPoint =
      shot.segments[0]?.path[
        (shot.segments[0]?.path.length ?? 1) - 1
      ] ?? shot.finalPoint;
    const expansion = (progress - 0.39) / 0.11;
    context.save();
    context.strokeStyle = "#d38cff";
    context.lineWidth = 3;
    context.globalAlpha = 1 - expansion;
    context.beginPath();
    context.arc(splitPoint.x, splitPoint.y, 9 + expansion * 34, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  if (shot.weaponId === "digger" && progress > 0.42 && progress < 0.8) {
    const local = (progress - 0.42) / 0.38;
    const point = pathPoint(
      shot.segments[1]?.path ?? [shot.finalPoint],
      local,
    );
    context.save();
    context.strokeStyle = "rgba(255,157,87,0.35)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(point.x, surfaceForTank(model.terrain, point.x) - 2, 24, 7, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  if (shot.weaponId === "napalm" && progress > 0.54) {
    const spread = clamp((progress - 0.54) / 0.24, 0, 1);
    const visible = Math.ceil(shot.flowPoints.length * spread);
    context.save();
    context.globalCompositeOperation = "lighter";
    for (let index = 0; index < visible; index += 1) {
      const point = shot.flowPoints[index] as Vector2;
      const flicker = Math.sin(now * 0.014 + index * 1.7);
      const height = 10 + (index % 4) * 3 + flicker * 3;
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

  if (shot.weaponId === "dirtBloom" && progress > shot.resolvedAt) {
    const bloom = clamp(
      (progress - shot.resolvedAt) / (shot.endsAt - shot.resolvedAt),
      0,
      1,
    );
    context.save();
    context.translate(shot.finalPoint.x, shot.finalPoint.y - 10);
    context.strokeStyle = `rgba(216,255,69,${0.68 * (1 - bloom * 0.45)})`;
    context.fillStyle = "rgba(216,255,69,0.10)";
    context.shadowColor = "#d8ff45";
    context.shadowBlur = model.reducedMotion ? 4 : 18;
    for (let ray = 0; ray < 10; ray += 1) {
      const angle = (Math.PI * 2 * ray) / 10;
      const length = 10 + bloom * (25 + (ray % 3) * 5);
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

  if (progress > shot.resolvedAt && shot.weaponId !== "napalm") {
    const aftermath = clamp(
      (progress - shot.resolvedAt) /
        Math.max(0.01, shot.endsAt - shot.resolvedAt),
      0,
      1,
    );
    const color =
      shot.weaponId === "dirtBloom"
        ? "#d8ff45"
        : shot.weaponId === "digger"
          ? "#ff9d57"
          : shot.weaponId === "mirv"
            ? "#d38cff"
            : shot.weaponId === "roller"
              ? "#68e5ef"
              : "#ffe083";
    context.save();
    context.strokeStyle = color;
    context.lineWidth = 3 - aftermath * 2;
    context.globalAlpha = 1 - aftermath;
    shot.impactPoints.forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 8 + aftermath * 52, 0, Math.PI * 2);
      context.stroke();
    });
    context.restore();
  }
}

function updateParticles(
  particles: Particle[],
  deltaSeconds: number,
): void {
  for (const particle of particles) {
    particle.age += deltaSeconds;
    particle.vx *= Math.pow(particle.drag, deltaSeconds * 60);
    particle.vy =
      particle.vy * Math.pow(particle.drag, deltaSeconds * 60) +
      particle.gravity * deltaSeconds;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
  }

  let writeIndex = 0;
  for (const particle of particles) {
    if (particle.age < particle.life) {
      particles[writeIndex] = particle;
      writeIndex += 1;
    }
  }
  particles.length = writeIndex;
}

function drawParticles(
  context: CanvasRenderingContext2D,
  particles: readonly Particle[],
): void {
  context.save();
  context.globalCompositeOperation = "lighter";
  for (const particle of particles) {
    const life = clamp(1 - particle.age / particle.life, 0, 1);
    context.globalAlpha = life * (particle.kind === "smoke" ? 0.28 : 0.85);
    context.fillStyle = particle.color;

    if (particle.kind === "prism") {
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.age * 4);
      context.fillRect(
        -particle.size / 2,
        -particle.size / 2,
        particle.size,
        particle.size,
      );
      context.restore();
    } else {
      context.beginPath();
      context.arc(
        particle.x,
        particle.y,
        particle.size * (particle.kind === "smoke" ? 1.25 - life * 0.25 : life),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
  context.restore();
}

function spawnImpactParticles(
  particles: Particle[],
  shot: ShotVisual,
  effectLevel: EffectLevel,
): void {
  const density =
    effectLevel === "full" ? 1 : effectLevel === "balanced" ? 0.62 : 0.3;
  const random = new SeededRandom(`${shot.seed}:presentation`);
  const baseCount =
    shot.weaponId === "mirv"
      ? 28
      : shot.weaponId === "napalm"
        ? 46
        : shot.weaponId === "dirtBloom"
          ? 38
          : 52;
  const colors: Record<WeaponId, readonly string[]> = {
    shell: ["#fff4b1", "#ffb54d", "#ff6658"],
    mirv: ["#f8b5ff", "#d38cff", "#68e5ef"],
    roller: ["#c6fbff", "#68e5ef", "#3d9eb8"],
    digger: ["#ffd0a4", "#ff9d57", "#705040"],
    napalm: ["#fff0a3", "#ffb34d", "#ff4e3d"],
    dirtBloom: ["#f3ffc1", "#d8ff45", "#75b15e"],
  };
  const centers =
    shot.weaponId === "mirv" ? shot.impactPoints : [shot.finalPoint];

  centers.forEach((center) => {
    const count = Math.max(6, Math.round((baseCount * density) / centers.length));
    for (let index = 0; index < count; index += 1) {
      const angle = random.float(-Math.PI, 0);
      const speed = random.float(35, 210);
      const kind: Particle["kind"] =
        shot.weaponId === "mirv"
          ? "prism"
          : shot.weaponId === "napalm"
            ? "ember"
            : shot.weaponId === "dirtBloom" ||
                shot.weaponId === "digger"
              ? "soil"
              : index % 5 === 0
                ? "smoke"
                : "spark";
      particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: random.float(0.55, 1.55),
        size: random.float(2, kind === "smoke" ? 9 : 5),
        color: random.pick(colors[shot.weaponId]),
        drag: kind === "smoke" ? 0.97 : 0.985,
        gravity: kind === "smoke" ? -8 : 190,
        kind,
      });
    }
  });
}

function makeAudioEngine(): AudioEngine | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  const context = new AudioContextConstructor();
  const master = context.createGain();
  master.gain.value = 0.16;
  master.connect(context.destination);
  return { context, master };
}

function audioTone(
  engine: AudioEngine,
  frequency: number,
  duration: number,
  type: OscillatorType,
  sweep = 0,
  volume = 0.35,
  delay = 0,
): void {
  const start = engine.context.currentTime + delay;
  const oscillator = engine.context.createOscillator();
  const gain = engine.context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(30, frequency + sweep),
    start + duration,
  );
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(engine.master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playLaunch(engine: AudioEngine, weaponId: WeaponId): void {
  const settings: Record<
    WeaponId,
    readonly [number, number, OscillatorType, number]
  > = {
    shell: [180, 0.16, "square", 230],
    mirv: [260, 0.28, "triangle", 620],
    roller: [110, 0.32, "sawtooth", 180],
    digger: [95, 0.4, "sawtooth", -35],
    napalm: [140, 0.36, "triangle", 80],
    dirtBloom: [190, 0.3, "sine", 390],
  };
  const [frequency, duration, type, sweep] = settings[weaponId];
  audioTone(engine, frequency, duration, type, sweep, 0.35);
  if (weaponId === "mirv" || weaponId === "dirtBloom") {
    audioTone(engine, frequency * 1.5, duration * 0.8, "sine", sweep * 0.4, 0.18, 0.05);
  }
}

function playImpact(engine: AudioEngine, weaponId: WeaponId): void {
  if (weaponId === "mirv") {
    for (let index = 0; index < 5; index += 1) {
      audioTone(engine, 150 + index * 28, 0.22, "square", -90, 0.2, index * 0.045);
    }
    return;
  }

  if (weaponId === "napalm") {
    audioTone(engine, 90, 0.7, "sawtooth", -35, 0.24);
    audioTone(engine, 420, 0.5, "sine", -250, 0.14, 0.08);
    return;
  }

  if (weaponId === "dirtBloom") {
    audioTone(engine, 130, 0.52, "sine", 440, 0.25);
    audioTone(engine, 260, 0.48, "triangle", 510, 0.18, 0.05);
    return;
  }

  const base = weaponId === "digger" ? 74 : weaponId === "roller" ? 105 : 120;
  audioTone(engine, base, 0.46, "sawtooth", -45, 0.42);
  audioTone(engine, base * 2.8, 0.18, "square", -160, 0.13);
}

function playerStyle(color: string): CSSProperties {
  return { "--player-color": color } as CSSProperties;
}

function weaponStyle(color: string): CSSProperties {
  return { "--weapon-color": color } as CSSProperties;
}

export default function ScorchedGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainCacheRef = useRef<TerrainCache | null>(null);
  const gameRef = useRef<GameModel>(createGame());
  const shotRef = useRef<ShotVisual | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const audioRef = useRef<AudioEngine | null>(null);
  const impactAudioPlayedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const [, setRevision] = useState(0);

  const model = gameRef.current;
  const activeTank = model.tanks[model.activePlayer];
  const selectedWeapon = chooseAvailableWeapon(model, model.activePlayer);
  const controlsLocked = model.phase !== "aiming" || model.paused;

  const refresh = useCallback(() => {
    setRevision((revision) => revision + 1);
  }, []);

  const ensureAudio = useCallback(async () => {
    if (!gameRef.current.audioEnabled) {
      return null;
    }

    try {
      const audio = audioRef.current ?? makeAudioEngine();
      if (!audio) {
        gameRef.current.audioEnabled = false;
        refresh();
        return null;
      }
      audioRef.current = audio;
      if (audio.context.state === "suspended") {
        await audio.context.resume();
      }
      return audio;
    } catch {
      audioRef.current = null;
      gameRef.current.audioEnabled = false;
      refresh();
      return null;
    }
  }, [refresh]);

  const finishShot = useCallback(() => {
    const game = gameRef.current;
    const shot = shotRef.current;
    if (!shot || shot.completed) {
      return;
    }

    shot.completed = true;
    game.message = shotOutcomeText(game);

    const somebodyDestroyed = game.tanks.some((tank) => tank.health <= 0);
    game.turn += 1;
    if (somebodyDestroyed || game.turn >= MAX_TURNS_PER_ROUND) {
      completeRound(game);
    } else {
      game.activePlayer = game.activePlayer === 0 ? 1 : 0;
      const nextWeapon = chooseAvailableWeapon(game, game.activePlayer);
      game.selectedWeapons[game.activePlayer] = nextWeapon;
      game.phase = "aiming";
      game.message = `${game.tanks[game.activePlayer].name}: учитывайте ветер и след прошлого выстрела.`;
    }

    shotRef.current = null;
    refresh();
  }, [refresh]);

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
        updateParticles(particlesRef.current, delta);
      }

      drawBackdrop(context, now);
      const terrainCanvas = renderTerrain(
        game.terrain,
        game.terrainRevision,
        terrainCacheRef,
      );
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

      const shot = shotRef.current;
      if (shot) {
        if (!game.paused) {
          shot.elapsedMs += delta * 1_000;
        }
        const progress = clamp(shot.elapsedMs / shot.duration, 0, 1);
        drawShot(context, shot, progress, game, now);

        if (!game.paused && !shot.resolved && progress >= shot.resolvedAt) {
          shot.resolved = true;
          resolveWeapon(game, shot);
          spawnImpactParticles(
            particlesRef.current,
            shot,
            game.effectLevel,
          );
          if (!impactAudioPlayedRef.current && audioRef.current) {
            impactAudioPlayedRef.current = true;
            try {
              playImpact(audioRef.current, shot.weaponId);
            } catch {
              audioRef.current = null;
              game.audioEnabled = false;
            }
          }
          refresh();
        }

        if (!game.paused && progress >= shot.endsAt) {
          finishShot();
        }
      }

      drawParticles(context, particlesRef.current);
      frameRef.current = requestAnimationFrame(renderFrame);
    };

    frameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [finishShot, refresh]);

  const adjustAngle = useCallback(
    (next: number) => {
      const game = gameRef.current;
      if (game.phase !== "aiming" || game.paused) {
        return;
      }
      game.tanks[game.activePlayer].angleDegrees = clamp(
        Math.round(next),
        5,
        88,
      );
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
      tank.power = clamp(Math.round(next / 10) * 10, 180, healthLimit);
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
      if (!canUseWeapon(game.tanks[game.activePlayer], weaponId)) {
        game.message = `${WEAPON_COPY[weaponId].name}: боезапас исчерпан.`;
        refresh();
        return;
      }
      game.selectedWeapons[game.activePlayer] = weaponId;
      game.message = SHOT_STATUS[weaponId];
      void ensureAudio();
      refresh();
    },
    [ensureAudio, refresh],
  );

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
          canUseWeapon(game.tanks[game.activePlayer], candidate.id)
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

    const weaponId = chooseAvailableWeapon(game, game.activePlayer);
    const tank = game.tanks[game.activePlayer];
    if (weaponId !== "shell") {
      tank.inventory[weaponId] = Math.max(
        0,
        (tank.inventory[weaponId] ?? 0) - 1,
      );
    }

    impactAudioPlayedRef.current = false;
    shotRef.current = buildShot(game, weaponId);
    game.phase = "firing";
    game.message = `${tank.name} запускает «${WEAPON_COPY[weaponId].name}».`;
    refresh();

    void ensureAudio().then((audio) => {
      if (!audio) {
        return;
      }
      try {
        playLaunch(audio, weaponId);
      } catch {
        audioRef.current = null;
        game.audioEnabled = false;
        refresh();
      }
    });
  }, [ensureAudio, refresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLButtonElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.code === "Escape" || event.code === "KeyP") {
        const game = gameRef.current;
        if (
          game.phase === "aiming" ||
          game.phase === "firing" ||
          game.paused
        ) {
          game.paused = !game.paused;
          refresh();
        }
        return;
      }

      if (gameRef.current.phase !== "aiming") {
        return;
      }

      if (event.code === "ArrowUp") {
        event.preventDefault();
        adjustAngle(gameRef.current.tanks[gameRef.current.activePlayer].angleDegrees + 1);
      }
      if (event.code === "ArrowDown") {
        event.preventDefault();
        adjustAngle(gameRef.current.tanks[gameRef.current.activePlayer].angleDegrees - 1);
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        adjustPower(gameRef.current.tanks[gameRef.current.activePlayer].power + 10);
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        adjustPower(gameRef.current.tanks[gameRef.current.activePlayer].power - 10);
      }
      if (event.code === "KeyQ") {
        cycleWeapon(-1);
      }
      if (event.code === "KeyE") {
        cycleWeapon(1);
      }
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        void fire();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adjustAngle, adjustPower, cycleWeapon, fire, refresh]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        const game = gameRef.current;
        if (game.phase === "aiming" || game.phase === "firing") {
          game.paused = true;
          refresh();
        }
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

  const startMatch = useCallback(() => {
    const game = gameRef.current;
    game.phase = "aiming";
    game.message = `${game.tanks[game.activePlayer].name}: выберите оружие и сделайте первый выстрел.`;
    refresh();
    void ensureAudio();
  }, [ensureAudio, refresh]);

  const openRoundResult = useCallback(() => {
    const game = gameRef.current;
    if (game.round >= TOTAL_ROUNDS) {
      game.phase = "matchEnd";
      game.message = "Три раунда завершены.";
    } else {
      game.phase = "shop";
      game.shopPlayer = 0;
      game.message = `${game.tanks[0].name}: выберите покупки на следующий раунд.`;
    }
    refresh();
  }, [refresh]);

  const buyWeapon = useCallback(
    (weaponId: WeaponId) => {
      const game = gameRef.current;
      if (game.phase !== "shop") {
        return;
      }
      const tank = game.tanks[game.shopPlayer];
      const weapon = WEAPONS.find((candidate) => candidate.id === weaponId);
      if (
        !weapon ||
        weapon.ammo.kind !== "finite" ||
        tank.credits < weapon.price
      ) {
        return;
      }
      tank.credits -= weapon.price;
      tank.inventory[weaponId] =
        (tank.inventory[weaponId] ?? 0) + weapon.ammo.bundleSize;
      game.message = `${tank.name}: «${WEAPON_COPY[weaponId].name}» +${weapon.ammo.bundleSize}.`;
      void ensureAudio().then((audio) => {
        if (audio) {
          try {
            audioTone(audio, 260, 0.12, "sine", 320, 0.18);
          } catch {
            audioRef.current = null;
            game.audioEnabled = false;
            refresh();
          }
        }
      });
      refresh();
    },
    [ensureAudio, refresh],
  );

  const buyUpgrade = useCallback(
    (kind: "health" | "shield") => {
      const game = gameRef.current;
      if (game.phase !== "shop") {
        return;
      }
      const tank = game.tanks[game.shopPlayer];
      const price = kind === "health" ? 3_000 : 4_500;
      if (tank.credits < price) {
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
      void ensureAudio().then((audio) => {
        if (audio) {
          try {
            audioTone(
              audio,
              kind === "health" ? 180 : 360,
              0.16,
              "triangle",
              260,
              0.18,
            );
          } catch {
            audioRef.current = null;
            game.audioEnabled = false;
            refresh();
          }
        }
      });
      refresh();
    },
    [ensureAudio, refresh],
  );

  const finishShopping = useCallback(() => {
    const game = gameRef.current;
    if (game.phase !== "shop") {
      return;
    }
    if (game.shopPlayer === 0) {
      game.shopPlayer = 1;
      game.message = `${game.tanks[1].name}: теперь ваши покупки.`;
    } else {
      prepareNextRound(game);
    }
    refresh();
  }, [refresh]);

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
    if (!game.paused) {
      void ensureAudio();
    }
    refresh();
  }, [ensureAudio, refresh]);

  const resetGame = useCallback(() => {
    const previous = gameRef.current;
    gameRef.current = createGame(previous.seed + 1);
    gameRef.current.audioEnabled = previous.audioEnabled;
    gameRef.current.reducedMotion = previous.reducedMotion;
    gameRef.current.effectLevel = previous.effectLevel;
    shotRef.current = null;
    particlesRef.current = [];
    terrainCacheRef.current = null;
    refresh();
  }, [refresh]);

  const toggleAudio = useCallback(() => {
    const game = gameRef.current;
    game.audioEnabled = !game.audioEnabled;
    if (game.audioEnabled) {
      void ensureAudio();
    } else if (audioRef.current) {
      void audioRef.current.context.suspend().catch(() => undefined);
    }
    refresh();
  }, [ensureAudio, refresh]);

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

  return (
    <div className={styles.game}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        aria-label="Артиллерийское поле с двумя танками и разрушаемым рельефом"
      />

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
            aria-label={`${tank.name}: состояние ${Math.ceil(tank.health)}, щит ${Math.ceil(tank.shield)}`}
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
              <span>Щит {Math.ceil(tank.shield)}</span>
            </div>
          </section>
        ))}

        <section className={styles.roundHud} aria-label="Раунд и ветер">
          <p className={styles.eyebrow}>Quick Match</p>
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

      {model.phase === "aiming" && (
        <div className={styles.controlDeck}>
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

          <section className={styles.weaponRail} aria-label="Выбор оружия">
            <div className={styles.weaponList}>
              {WEAPONS.map((weapon) => {
                const ammo = weaponAmmo(activeTank, weapon.id);
                const available = canUseWeapon(activeTank, weapon.id);
                return (
                  <button
                    type="button"
                    key={weapon.id}
                    className={`${styles.weaponCard} ${
                      selectedWeapon === weapon.id
                        ? styles.weaponCardSelected
                        : ""
                    }`}
                    style={weaponStyle(weapon.accent)}
                    onClick={() => selectWeapon(weapon.id)}
                    disabled={controlsLocked || !available}
                    aria-pressed={selectedWeapon === weapon.id}
                    aria-label={`${WEAPON_COPY[weapon.id].name}, ${
                      weapon.id === "shell"
                        ? "бесконечный запас"
                        : `боезапас ${ammo}`
                    }`}
                  >
                    <span className={styles.weaponIcon} aria-hidden="true">
                      {WEAPON_COPY[weapon.id].icon}
                    </span>
                    <span className={styles.weaponName}>
                      {WEAPON_COPY[weapon.id].short}
                    </span>
                    <span className={styles.ammo}>
                      {weapon.id === "shell" ? "∞ базовый" : `× ${ammo}`}
                    </span>
                  </button>
                );
              })}
            </div>
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
                ← → сила · ↑ ↓ угол · Q/E оружие
              </span>
            </div>
            <button
              type="button"
              className={styles.fireButton}
              onClick={() => void fire()}
              disabled={controlsLocked}
              aria-label={`Огонь: ${WEAPON_COPY[selectedWeapon].name}`}
            >
              Огонь
            </button>
          </section>
        </div>
      )}

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
              учтите ветер, меняйте рельеф шестью видами оружия и закупайтесь
              между раундами.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.modalButtonPrimary}`}
                onClick={() => void startMatch()}
              >
                Начать бой
              </button>
            </div>
            <p className={styles.modalText}>
              На клавиатуре: стрелки, Q/E, пробел. На телефоне — крупные
              кнопки и слайдеры.
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
            <div className={styles.toggleGrid}>
              <button
                type="button"
                className={styles.toggleButton}
                onClick={toggleAudio}
              >
                <span>Звук</span>
                <span className={styles.toggleState}>
                  {model.audioEnabled ? "Вкл" : "Выкл"}
                </span>
              </button>
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
              Оба пилота получили награду за нанесённый урон. Победителю
              начислен дополнительный бонус.
            </p>
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
                {model.round >= TOTAL_ROUNDS ? "Итоги матча" : "В магазин"}
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
                  ₡ {formatCredits(model.tanks[model.shopPlayer].credits)}
                </span>
              </div>
            </div>

            <div className={styles.shopGrid}>
              {WEAPONS.filter((weapon) => weapon.id !== "shell").map(
                (weapon) => {
                  const tank = model.tanks[model.shopPlayer];
                  const bundle =
                    weapon.ammo.kind === "finite"
                      ? weapon.ammo.bundleSize
                      : 0;
                  return (
                    <button
                      type="button"
                      key={weapon.id}
                      className={styles.shopCard}
                      style={weaponStyle(weapon.accent)}
                      disabled={tank.credits < weapon.price}
                      onClick={() => buyWeapon(weapon.id)}
                    >
                      <span className={styles.weaponIcon} aria-hidden="true">
                        {WEAPON_COPY[weapon.id].icon}
                      </span>
                      <span className={styles.shopCardTitle}>
                        {WEAPON_COPY[weapon.id].name}
                      </span>
                      <span className={styles.shopCardDescription}>
                        {WEAPON_DESCRIPTION[weapon.id]}
                      </span>
                      <span className={styles.shopCardMeta}>
                        <span>₡ {formatCredits(weapon.price)}</span>
                        <span>+{bundle}</span>
                      </span>
                    </button>
                  );
                },
              )}

              <button
                type="button"
                className={styles.shopCard}
                style={weaponStyle("#d8ff45")}
                disabled={model.tanks[model.shopPlayer].credits < 3_000}
                onClick={() => buyUpgrade("health")}
              >
                <span className={styles.weaponIcon} aria-hidden="true">
                  ⬡
                </span>
                <span className={styles.shopCardTitle}>Усиление корпуса</span>
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
                disabled={model.tanks[model.shopPlayer].credits < 4_500}
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
            <p className={styles.eyebrow}>Quick Match завершён</p>
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
          ? `Выстрел: ${WEAPON_COPY[selectedWeapon].name}`
          : ""}
      </span>
    </div>
  );
}
