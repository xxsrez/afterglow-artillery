import {
  EXPERIMENTAL_PARTICLE_CAPS,
  SeededRandom,
  getDemoBehavior,
  getExperimentalUltimate,
  getWeapon,
  getWeaponEffectProfile,
  isExperimentalUltimateId,
  pointAlongPathInto,
  type ExperimentalResolutionResult,
  type ExperimentalUltimateId,
  type Vector2,
  type WeaponId,
} from "../../lib/game";

export type EffectLevel = "full" | "balanced" | "reduced";

export interface Particle {
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
  kind:
    | "spark"
    | "smoke"
    | "ember"
    | "soil"
    | "prism"
    | "confetti";
}

export interface ParticleShot {
  readonly weaponId: WeaponId | ExperimentalUltimateId;
  readonly seed: number;
  readonly fizzled: boolean;
  readonly segments: readonly {
    readonly path: readonly Vector2[];
  }[];
  readonly impactPoints: readonly Vector2[];
  readonly finalPoint: Vector2;
  readonly experimentalResult?: ExperimentalResolutionResult;
}

/** Quick Demo budget from ADR 0004. */
export const CANONICAL_PARTICLE_CAP = 320;

/**
 * The pool must accommodate the largest supported effect, while each effect
 * family still applies its own active-particle cap when emitting.
 */
export const PARTICLE_POOL_CAP = EXPERIMENTAL_PARTICLE_CAPS.desktop;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function takeParticle(pool: Particle[]): Particle {
  return (
    pool.pop() ?? {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 1,
      size: 1,
      color: "#ffffff",
      drag: 1,
      gravity: 0,
      kind: "spark",
    }
  );
}

export function updateParticles(
  particles: Particle[],
  deltaSeconds: number,
  pool: Particle[],
): void {
  for (const particle of particles) {
    const dragDecay = Math.pow(particle.drag, deltaSeconds * 60);
    particle.age += deltaSeconds;
    particle.vx *= dragDecay;
    particle.vy =
      particle.vy * dragDecay + particle.gravity * deltaSeconds;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
  }

  let writeIndex = 0;
  for (const particle of particles) {
    if (particle.age < particle.life) {
      particles[writeIndex] = particle;
      writeIndex += 1;
    } else if (pool.length < PARTICLE_POOL_CAP) {
      pool.push(particle);
    }
  }
  particles.length = writeIndex;
}

export function drawParticles(
  context: CanvasRenderingContext2D,
  particles: readonly Particle[],
): void {
  context.save();
  context.globalCompositeOperation = "lighter";
  for (const particle of particles) {
    const life = clamp(1 - particle.age / particle.life, 0, 1);
    context.globalAlpha = life * (particle.kind === "smoke" ? 0.28 : 0.85);
    context.fillStyle = particle.color;

    if (particle.kind === "prism" || particle.kind === "confetti") {
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.age * (particle.kind === "confetti" ? 7 : 4));
      context.fillRect(
        -particle.size / 2,
        -particle.size * (particle.kind === "confetti" ? 0.28 : 0.5),
        particle.size,
        particle.size * (particle.kind === "confetti" ? 0.56 : 1),
      );
      context.restore();
    } else {
      context.beginPath();
      context.arc(
        particle.x,
        particle.y,
        particle.size *
          (particle.kind === "smoke" ? 1.25 - life * 0.25 : life),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
  context.restore();
}

export function spawnImpactParticles(
  particles: Particle[],
  shot: ParticleShot,
  effectLevel: EffectLevel,
  pool: Particle[],
  phone: boolean,
): void {
  const random = new SeededRandom(`${shot.seed}:presentation`);
  if (isExperimentalUltimateId(shot.weaponId)) {
    const definition = getExperimentalUltimate(shot.weaponId);
    const hardCap =
      effectLevel === "reduced"
        ? EXPERIMENTAL_PARTICLE_CAPS.reduced
        : phone
          ? EXPERIMENTAL_PARTICLE_CAPS.phone
          : EXPERIMENTAL_PARTICLE_CAPS.desktop;
    const requestedBudget = definition.quality[effectLevel].particles;
    const availableBudget = Math.max(
      0,
      Math.min(requestedBudget, hardCap - particles.length),
    );
    const centers =
      shot.experimentalResult?.mechanicPoints.slice(0, 10) ??
      [shot.finalPoint];
    const colors = [
      definition.accent,
      definition.secondaryAccent,
      "#fff7dc",
    ] as const;

    for (let index = 0; index < availableBudget; index += 1) {
      const center =
        centers[index % Math.max(1, centers.length)] ?? shot.finalPoint;
      const angle =
        definition.strategy === "top-down-column"
          ? random.float(-Math.PI * 0.72, -Math.PI * 0.28)
          : definition.strategy === "volcanic-construction"
            ? random.float(-Math.PI * 0.92, -Math.PI * 0.08)
            : random.float(-Math.PI, Math.PI);
      const speed = random.float(
        26,
        clamp(definition.footprint.spectacleRadius * 1.35, 90, 300),
      );
      const particle = takeParticle(pool);
      particle.x = center.x;
      particle.y = center.y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.age = 0;
      particle.life = random.float(
        0.8,
        Math.min(4, definition.aftermathMs / 1_000),
      );
      particle.size = random.float(2, effectLevel === "full" ? 7 : 5);
      particle.color = random.pick(colors);
      particle.drag =
        definition.strategy === "gravity-pulses" ? 0.965 : 0.982;
      particle.gravity =
        definition.strategy === "top-down-column" ? -34 : 105;
      particle.kind =
        definition.strategy === "rock-transmutation" ||
        definition.strategy === "reverse-bounce-chain"
          ? "prism"
          : definition.strategy === "volcanic-construction"
            ? "ember"
            : definition.strategy === "branching-faults"
              ? "soil"
              : index % 7 === 0
                ? "smoke"
                : "spark";
      particles.push(particle);
    }
    return;
  }

  const weapon = getWeapon(shot.weaponId);
  const behavior = getDemoBehavior(shot.weaponId);
  const profile = getWeaponEffectProfile(shot.weaponId);
  const requestedBudget = shot.fizzled
    ? Math.min(12, profile.particleBudget[effectLevel])
    : profile.particleBudget[effectLevel];
  const availableBudget = Math.max(
    0,
    Math.min(
      requestedBudget,
      CANONICAL_PARTICLE_CAP - particles.length,
    ),
  );
  const funkyColors = [
    "#ff4f81",
    "#ffb84d",
    "#f5ef65",
    "#5bf28d",
    "#5ce7ff",
    "#8e8bff",
    "#e66cff",
  ] as const;
  const colors: readonly string[] =
    behavior.kind === "funky"
      ? funkyColors
      : [weapon.accent, weapon.secondaryAccent, "#fff4d6"];
  const centers =
    behavior.kind === "airburst" ||
    behavior.kind === "leap-frog" ||
    behavior.kind === "funky" ||
    behavior.kind === "sandhog"
      ? shot.impactPoints
      : [shot.finalPoint];
  let emitted = 0;

  if (shot.weaponId === "smokeTracer") {
    const trace = shot.segments[0]?.path ?? [];
    const sampleCount = Math.min(
      availableBudget,
      Math.max(6, Math.round(availableBudget * 0.7)),
    );
    const point = { x: 0, y: 0 };
    for (let index = 0; index < sampleCount; index += 1) {
      if (
        !pointAlongPathInto(
          trace,
          index / Math.max(1, sampleCount - 1),
          point,
        )
      ) {
        point.x = 0;
        point.y = 0;
      }
      const particle = takeParticle(pool);
      particle.x = point.x;
      particle.y = point.y;
      particle.vx = random.float(-4, 4);
      particle.vy = random.float(-12, -3);
      particle.age = 0;
      particle.life = random.float(1.8, 3.4);
      particle.size = random.float(4, 9);
      particle.color = random.pick(colors);
      particle.drag = 0.985;
      particle.gravity = -4;
      particle.kind = "smoke";
      particles.push(particle);
      emitted += 1;
    }
  }

  centers.forEach((center) => {
    const remaining = Math.max(0, availableBudget - emitted);
    const count = Math.min(
      remaining,
      Math.max(1, Math.ceil(remaining / Math.max(1, centers.length))),
    );
    for (let index = 0; index < count; index += 1) {
      const angle = random.float(-Math.PI, 0);
      const speed = random.float(
        35,
        clamp(profile.spectacleRadius * 1.8, 120, 360),
      );
      const kind: Particle["kind"] =
        behavior.kind === "funky"
          ? index % 3 === 0
            ? "confetti"
            : "prism"
          : behavior.kind === "airburst"
            ? "prism"
            : behavior.kind === "napalm"
              ? "ember"
              : behavior.kind === "dirt-sphere" ||
                  behavior.kind === "liquid-dirt" ||
                  behavior.kind === "dirt-wedge" ||
                  behavior.kind === "digger" ||
                  behavior.kind === "sandhog"
                ? "soil"
                : index % 5 === 0
                  ? "smoke"
                  : "spark";
      const particle = takeParticle(pool);
      particle.x = center.x;
      particle.y = center.y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.age = 0;
      particle.life = random.float(
        0.55,
        Math.max(0.9, profile.aftermathMs / 1_000),
      );
      particle.size = random.float(
        2,
        kind === "smoke"
          ? 10
          : profile.signature === "nuclear"
            ? 7
            : 5,
      );
      particle.color = random.pick(colors);
      particle.drag = kind === "smoke" ? 0.97 : 0.985;
      particle.gravity = kind === "smoke" ? -8 : 190;
      particle.kind = kind;
      particles.push(particle);
      emitted += 1;
    }
  });
}
