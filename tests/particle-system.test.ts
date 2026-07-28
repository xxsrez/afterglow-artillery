import { describe, expect, it, vi } from "vitest";

import {
  CANONICAL_PARTICLE_CAP,
  PARTICLE_POOL_CAP,
  spawnImpactParticles,
  updateParticles,
  type Particle,
  type ParticleShot,
} from "../app/game/particle-system";
import { EXPERIMENTAL_PARTICLE_CAPS } from "../lib/game";

function particle(overrides: Partial<Particle> = {}): Particle {
  return {
    x: 900,
    y: 800,
    vx: 700,
    vy: 600,
    age: 5,
    life: 1,
    size: 99,
    color: "#badbad",
    drag: 0.5,
    gravity: 400,
    kind: "confetti",
    ...overrides,
  };
}

function shot(
  weaponId: ParticleShot["weaponId"],
  overrides: Partial<ParticleShot> = {},
): ParticleShot {
  return {
    weaponId,
    seed: 73_011,
    fizzled: false,
    segments: [
      {
        path: [
          { x: 12, y: 18 },
          { x: 42, y: 30 },
        ],
      },
    ],
    impactPoints: [{ x: 42, y: 30 }],
    finalPoint: { x: 42, y: 30 },
    ...overrides,
  };
}

describe("particle lifecycle", () => {
  it("updates drag once per particle and returns expired objects to the pool", () => {
    const expired = particle({ age: 0.9, life: 1 });
    const alive = particle({ age: 0.1, life: 2 });
    const particles = [expired, alive];
    const pool: Particle[] = [];
    const pow = vi.spyOn(Math, "pow");

    updateParticles(particles, 0.2, pool);

    expect(pow).toHaveBeenCalledTimes(2);
    pow.mockRestore();
    expect(particles).toEqual([alive]);
    expect(pool).toEqual([expired]);
  });

  it("reuses canonical particle objects and fully overwrites stale fields", () => {
    const stale = Array.from({ length: 34 }, () => particle());
    const pool = [...stale];
    const reused: Particle[] = [];
    const fresh: Particle[] = [];

    spawnImpactParticles(reused, shot("babyMissile"), "full", pool, false);
    spawnImpactParticles(fresh, shot("babyMissile"), "full", [], false);

    expect(reused).toHaveLength(34);
    expect(reused).toEqual(fresh);
    expect(stale.every((item) => reused.includes(item))).toBe(true);
    expect(pool).toHaveLength(0);
  });

  it("keeps canonical and Experimental active caps independent", () => {
    const canonical = Array.from(
      { length: CANONICAL_PARTICLE_CAP - 1 },
      () => particle({ age: 0, life: 10 }),
    );
    spawnImpactParticles(canonical, shot("nuke"), "full", [], false);
    expect(canonical).toHaveLength(CANONICAL_PARTICLE_CAP);

    const phone: Particle[] = [];
    spawnImpactParticles(phone, shot("novaRing"), "full", [], true);
    expect(phone).toHaveLength(EXPERIMENTAL_PARTICLE_CAPS.phone);

    const reduced: Particle[] = [];
    spawnImpactParticles(reduced, shot("novaRing"), "reduced", [], false);
    expect(reduced).toHaveLength(EXPERIMENTAL_PARTICLE_CAPS.reduced);

    expect(PARTICLE_POOL_CAP).toBe(EXPERIMENTAL_PARTICLE_CAPS.desktop);
    expect(CANONICAL_PARTICLE_CAP).toBe(320);
  });

  it("never lets the recycled-object pool grow past its hard bound", () => {
    const particles = Array.from(
      { length: PARTICLE_POOL_CAP + 40 },
      () => particle({ age: 1, life: 0.5 }),
    );
    const pool: Particle[] = [];

    updateParticles(particles, 0.1, pool);

    expect(particles).toHaveLength(0);
    expect(pool).toHaveLength(PARTICLE_POOL_CAP);
  });
});
