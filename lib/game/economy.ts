import type { Inventory } from "./types";
import { getWeapon, WEAPON_IDS, type WeaponId } from "./weapons";

/** Exact per-item inventory limit documented by the Scorched Earth 1.5 manual. */
export const MAX_INVENTORY = 99;

/** Exact default interest rate documented by the Scorched Earth 1.5 manual. */
export const CLASSIC_INTEREST_RATE = 0.05;

/**
 * The manual describes the near-cap partial-bundle surcharge as approximately
 * 20%, without publishing a more precise formula. This named demo policy makes
 * that approximation explicit and keeps it out of canonical weapon data.
 */
export const DEMO_PARTIAL_BUNDLE_MARKUP_RATE = 0.2;

/**
 * Provisional demo-only resale policy. The manual says ordinary sales usually
 * lose money but does not publish the classic sell-back curve.
 */
export const DEMO_SELLBACK_RATE = 0.6;

export type PurchaseUnavailableReason =
  | "unlimited-weapon"
  | "inventory-full";

export interface AvailableWeaponPurchaseQuote {
  readonly kind: "available";
  readonly weaponId: WeaponId;
  readonly currentQuantity: number;
  readonly quantity: number;
  readonly resultingQuantity: number;
  readonly catalogBundleSize: number;
  readonly price: number;
  readonly isPartialBundle: boolean;
  readonly markupRate: number;
}

export interface UnavailableWeaponPurchaseQuote {
  readonly kind: "unavailable";
  readonly weaponId: WeaponId;
  readonly currentQuantity: number;
  readonly quantity: 0;
  readonly resultingQuantity: number;
  readonly catalogBundleSize: number;
  readonly price: 0;
  readonly isPartialBundle: false;
  readonly markupRate: 0;
  readonly reason: PurchaseUnavailableReason;
}

export type WeaponPurchaseQuote =
  | AvailableWeaponPurchaseQuote
  | UnavailableWeaponPurchaseQuote;

export interface PurchaseWeaponInput {
  readonly weaponId: WeaponId;
  readonly inventory: Readonly<Inventory>;
  readonly credits: number;
}

export interface SuccessfulWeaponPurchase {
  readonly ok: true;
  readonly weaponId: WeaponId;
  readonly inventory: Inventory;
  readonly credits: number;
  readonly spent: number;
  readonly quote: AvailableWeaponPurchaseQuote;
}

export interface FailedWeaponPurchase {
  readonly ok: false;
  readonly weaponId: WeaponId;
  readonly inventory: Inventory;
  readonly credits: number;
  readonly spent: 0;
  readonly reason: PurchaseUnavailableReason | "insufficient-credits";
  readonly quote: WeaponPurchaseQuote;
}

export type WeaponPurchaseResult =
  | SuccessfulWeaponPurchase
  | FailedWeaponPurchase;

export type SaleUnavailableReason =
  | "unlimited-weapon"
  | "no-inventory"
  | "insufficient-inventory";

export interface AvailableWeaponSaleQuote {
  readonly kind: "available";
  readonly weaponId: WeaponId;
  readonly currentQuantity: number;
  readonly requestedQuantity: number;
  readonly quantity: number;
  readonly resultingQuantity: number;
  readonly proceeds: number;
  readonly sellbackRate: number;
}

export interface UnavailableWeaponSaleQuote {
  readonly kind: "unavailable";
  readonly weaponId: WeaponId;
  readonly currentQuantity: number;
  readonly requestedQuantity: number;
  readonly quantity: 0;
  readonly resultingQuantity: number;
  readonly proceeds: 0;
  readonly sellbackRate: number;
  readonly reason: SaleUnavailableReason;
}

export type WeaponSaleQuote =
  | AvailableWeaponSaleQuote
  | UnavailableWeaponSaleQuote;

export interface SellWeaponInput {
  readonly weaponId: WeaponId;
  readonly inventory: Readonly<Inventory>;
  readonly credits: number;
  /** Number of individual shots to sell; defaults to one. */
  readonly quantity?: number;
}

export interface SuccessfulWeaponSale {
  readonly ok: true;
  readonly weaponId: WeaponId;
  readonly inventory: Inventory;
  readonly credits: number;
  readonly earned: number;
  readonly quote: AvailableWeaponSaleQuote;
}

export interface FailedWeaponSale {
  readonly ok: false;
  readonly weaponId: WeaponId;
  readonly inventory: Inventory;
  readonly credits: number;
  readonly earned: 0;
  readonly reason: SaleUnavailableReason;
  readonly quote: UnavailableWeaponSaleQuote;
}

export type WeaponSaleResult = SuccessfulWeaponSale | FailedWeaponSale;

/**
 * One shot of every finite weapon gives the vertical slice a complete,
 * inspectable arsenal without pretending this is a canonical starting loadout.
 * Baby Missile is omitted because its unlimited ammo is represented by kind.
 */
export function createDemoInventory(): Inventory {
  const inventory: Inventory = {};

  for (const weaponId of WEAPON_IDS) {
    if (getWeapon(weaponId).ammo.kind === "finite") {
      inventory[weaponId] = 1;
    }
  }

  return inventory;
}

/**
 * Quotes the next shop bundle. A full bundle always costs its exact listed
 * catalog price. Only the final bundle clipped by the 99-item cap uses the
 * documented approximately-20% partial-bundle markup.
 */
export function quoteWeaponPurchase(
  weaponId: WeaponId,
  inventory: Readonly<Inventory>,
): WeaponPurchaseQuote {
  const weapon = getWeapon(weaponId);
  const currentQuantity = readInventoryQuantity(inventory, weaponId);

  if (weapon.ammo.kind === "unlimited") {
    return {
      kind: "unavailable",
      weaponId,
      currentQuantity,
      quantity: 0,
      resultingQuantity: currentQuantity,
      catalogBundleSize: weapon.catalogBundleSize,
      price: 0,
      isPartialBundle: false,
      markupRate: 0,
      reason: "unlimited-weapon",
    };
  }

  const capacity = MAX_INVENTORY - currentQuantity;

  if (capacity === 0) {
    return {
      kind: "unavailable",
      weaponId,
      currentQuantity,
      quantity: 0,
      resultingQuantity: currentQuantity,
      catalogBundleSize: weapon.catalogBundleSize,
      price: 0,
      isPartialBundle: false,
      markupRate: 0,
      reason: "inventory-full",
    };
  }

  const quantity = Math.min(weapon.ammo.bundleSize, capacity);
  const isPartialBundle = quantity < weapon.ammo.bundleSize;
  const price = isPartialBundle
    ? Math.ceil(
        (weapon.catalogPrice *
          quantity *
          (1 + DEMO_PARTIAL_BUNDLE_MARKUP_RATE)) /
          weapon.ammo.bundleSize,
      )
    : weapon.catalogPrice;

  return {
    kind: "available",
    weaponId,
    currentQuantity,
    quantity,
    resultingQuantity: currentQuantity + quantity,
    catalogBundleSize: weapon.catalogBundleSize,
    price,
    isPartialBundle,
    markupRate: isPartialBundle ? DEMO_PARTIAL_BUNDLE_MARKUP_RATE : 0,
  };
}

/**
 * Applies a quoted purchase without mutating the caller's inventory. Failed
 * results also receive a defensive copy, so callers cannot mistake the result
 * for an in-place transaction.
 */
export function purchaseWeapon({
  weaponId,
  inventory,
  credits,
}: PurchaseWeaponInput): WeaponPurchaseResult {
  assertCredits(credits);

  const quote = quoteWeaponPurchase(weaponId, inventory);
  const nextInventory = { ...inventory };

  if (quote.kind === "unavailable") {
    return {
      ok: false,
      weaponId,
      inventory: nextInventory,
      credits,
      spent: 0,
      reason: quote.reason,
      quote,
    };
  }

  if (credits < quote.price) {
    return {
      ok: false,
      weaponId,
      inventory: nextInventory,
      credits,
      spent: 0,
      reason: "insufficient-credits",
      quote,
    };
  }

  nextInventory[weaponId] = quote.resultingQuantity;

  return {
    ok: true,
    weaponId,
    inventory: nextInventory,
    credits: credits - quote.price,
    spent: quote.price,
    quote,
  };
}

/**
 * Quotes resale of one individual shot (or an explicit quantity) under the
 * provisional 60% demo policy. This is deliberately not named or represented
 * as the unknown canonical sell-back formula.
 */
export function quoteWeaponSale(
  weaponId: WeaponId,
  inventory: Readonly<Inventory>,
  quantity = 1,
): WeaponSaleQuote {
  assertSaleQuantity(quantity);

  const weapon = getWeapon(weaponId);
  const currentQuantity = readInventoryQuantity(inventory, weaponId);

  if (weapon.ammo.kind === "unlimited") {
    return unavailableSaleQuote(
      weaponId,
      currentQuantity,
      quantity,
      "unlimited-weapon",
    );
  }

  if (currentQuantity === 0) {
    return unavailableSaleQuote(
      weaponId,
      currentQuantity,
      quantity,
      "no-inventory",
    );
  }

  if (quantity > currentQuantity) {
    return unavailableSaleQuote(
      weaponId,
      currentQuantity,
      quantity,
      "insufficient-inventory",
    );
  }

  const proceeds = Math.floor(
    (weapon.catalogPrice *
      quantity *
      DEMO_SELLBACK_RATE) /
      weapon.catalogBundleSize,
  );

  return {
    kind: "available",
    weaponId,
    currentQuantity,
    requestedQuantity: quantity,
    quantity,
    resultingQuantity: currentQuantity - quantity,
    proceeds,
    sellbackRate: DEMO_SELLBACK_RATE,
  };
}

/** Applies the provisional sale quote without mutating the input inventory. */
export function sellWeapon({
  weaponId,
  inventory,
  credits,
  quantity = 1,
}: SellWeaponInput): WeaponSaleResult {
  assertCredits(credits);

  const quote = quoteWeaponSale(weaponId, inventory, quantity);
  const nextInventory = { ...inventory };

  if (quote.kind === "unavailable") {
    return {
      ok: false,
      weaponId,
      inventory: nextInventory,
      credits,
      earned: 0,
      reason: quote.reason,
      quote,
    };
  }

  const nextCredits = credits + quote.proceeds;

  if (!Number.isSafeInteger(nextCredits)) {
    throw new RangeError("Balance after sale must be a safe integer.");
  }

  if (quote.resultingQuantity === 0) {
    delete nextInventory[weaponId];
  } else {
    nextInventory[weaponId] = quote.resultingQuantity;
  }

  return {
    ok: true,
    weaponId,
    inventory: nextInventory,
    credits: nextCredits,
    earned: quote.proceeds,
    quote,
  };
}

/**
 * Returns interest earned, not the resulting balance. The default 5% rate is
 * canonical; flooring fractional credits is an explicit deterministic demo
 * rounding policy because the manual does not publish its rounding rule.
 */
export function calculateInterest(
  credits: number,
  rate = CLASSIC_INTEREST_RATE,
): number {
  assertCredits(credits);

  if (!Number.isFinite(rate) || rate < 0) {
    throw new RangeError("Interest rate must be a finite non-negative number.");
  }

  return Math.floor(credits * rate);
}

/** Returns the balance after adding the interest calculated above. */
export function applyInterest(
  credits: number,
  rate = CLASSIC_INTEREST_RATE,
): number {
  const result = credits + calculateInterest(credits, rate);

  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Balance after interest must be a safe integer.");
  }

  return result;
}

function readInventoryQuantity(
  inventory: Readonly<Inventory>,
  weaponId: WeaponId,
): number {
  const quantity = inventory[weaponId] ?? 0;

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    quantity > MAX_INVENTORY
  ) {
    throw new RangeError(
      `Inventory quantity for ${weaponId} must be an integer from 0 to ${MAX_INVENTORY}.`,
    );
  }

  return quantity;
}

function assertCredits(credits: number): void {
  if (!Number.isSafeInteger(credits) || credits < 0) {
    throw new RangeError("Credits must be a non-negative safe integer.");
  }
}

function assertSaleQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError("Sale quantity must be a positive safe integer.");
  }
}

function unavailableSaleQuote(
  weaponId: WeaponId,
  currentQuantity: number,
  requestedQuantity: number,
  reason: SaleUnavailableReason,
): UnavailableWeaponSaleQuote {
  return {
    kind: "unavailable",
    weaponId,
    currentQuantity,
    requestedQuantity,
    quantity: 0,
    resultingQuantity: currentQuantity,
    proceeds: 0,
    sellbackRate: DEMO_SELLBACK_RATE,
    reason,
  };
}
