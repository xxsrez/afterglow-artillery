export type RandomSeed = number | string;

const UINT32_RANGE = 0x1_0000_0000;

/**
 * Converts user-facing numeric or textual seeds to a stable unsigned 32-bit
 * value. The string branch uses FNV-1a so it does not depend on runtime hash
 * implementations.
 */
export function normalizeSeed(seed: RandomSeed): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new RangeError("Seed must be a finite number.");
    }

    return Math.trunc(seed) >>> 0;
  }

  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Small deterministic PRNG based on Mulberry32.
 *
 * This class is the only randomness source intended for domain code. Visual
 * effects should use their own stream so presentation never advances the
 * mechanical sequence.
 */
export class SeededRandom {
  private stateValue: number;

  public constructor(seed: RandomSeed) {
    this.stateValue = normalizeSeed(seed);
  }

  public get state(): number {
    return this.stateValue;
  }

  public nextUint32(): number {
    this.stateValue = (this.stateValue + 0x6d2b79f5) >>> 0;

    let value = this.stateValue;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return (value ^ (value >>> 14)) >>> 0;
  }

  public next(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  public float(min = 0, max = 1): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      throw new RangeError("Random float range must be finite and ordered.");
    }

    return min + (max - min) * this.next();
  }

  public integer(minInclusive: number, maxExclusive: number): number {
    if (
      !Number.isSafeInteger(minInclusive) ||
      !Number.isSafeInteger(maxExclusive) ||
      maxExclusive <= minInclusive
    ) {
      throw new RangeError(
        "Random integer range must contain at least one safe integer.",
      );
    }

    return (
      minInclusive +
      Math.floor(this.next() * (maxExclusive - minInclusive))
    );
  }

  public chance(probability: number): boolean {
    if (
      !Number.isFinite(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      throw new RangeError("Probability must be between 0 and 1.");
    }

    return this.next() < probability;
  }

  public pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new RangeError("Cannot pick from an empty collection.");
    }

    return values[this.integer(0, values.length)] as T;
  }

  /**
   * Creates a stable independent stream without consuming this stream.
   */
  public fork(label: string): SeededRandom {
    return new SeededRandom(`${this.stateValue}:${label}`);
  }
}
