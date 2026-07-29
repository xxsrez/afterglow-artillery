import type { CameraViewport } from "./camera";

export const MOBILE_COMBAT_MAX_WIDTH = 960;
export const MOBILE_COMBAT_MAX_HEIGHT = 520;
export const MOBILE_COMBAT_MIN_HEIGHT = 286;

export interface CombatViewport extends CameraViewport {
  readonly dpr: number;
}

export interface ClientRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface VisualViewportLike {
  readonly width: number;
  readonly height: number;
}

export interface OcclusionInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

const finitePositive = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function isMobileCombatViewport(
  viewport: Pick<CombatViewport, "width" | "height">,
): boolean {
  return (
    viewport.width <= MOBILE_COMBAT_MAX_WIDTH ||
    viewport.height <= MOBILE_COMBAT_MAX_HEIGHT
  );
}

/**
 * iOS can keep the layout viewport taller than the visible area while browser
 * chrome is expanded. The measured combat surface must fit the visual
 * viewport, otherwise the bottom action rail remains visible behind the
 * toolbar but cannot receive taps.
 */
export function fitCombatViewport(
  rect: Pick<ClientRectLike, "width" | "height">,
  visualViewport?: VisualViewportLike,
): CameraViewport {
  const rectWidth = finitePositive(rect.width, 1);
  const rectHeight = finitePositive(rect.height, 1);
  const visualWidth = finitePositive(
    visualViewport?.width ?? rectWidth,
    rectWidth,
  );
  const visualHeight = finitePositive(
    visualViewport?.height ?? rectHeight,
    rectHeight,
  );

  return {
    width: Math.max(1, Math.round(Math.min(rectWidth, visualWidth))),
    height: Math.max(1, Math.round(Math.min(rectHeight, visualHeight))),
  };
}

export function clientPointToViewport(
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
  viewport: CameraViewport,
): { x: number; y: number } {
  const width = finitePositive(rect.width, viewport.width);
  const height = finitePositive(rect.height, viewport.height);
  const viewportWidth = finitePositive(viewport.width, width);
  const viewportHeight = finitePositive(viewport.height, height);

  return {
    x: clamp(
      ((clientX - rect.left) / width) * viewportWidth,
      0,
      viewportWidth,
    ),
    y: clamp(
      ((clientY - rect.top) / height) * viewportHeight,
      0,
      viewportHeight,
    ),
  };
}

export function pointInsideRect(
  clientX: number,
  clientY: number,
  rect: ClientRectLike,
): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.left + rect.width &&
    clientY >= rect.top &&
    clientY <= rect.top + rect.height
  );
}

/**
 * Keeps the tracked world point in the unobscured camera frame. The renderer
 * still sees the full viewport; HUD occlusion only changes composition.
 */
export function cameraCenterForOccludedTarget(
  target: { readonly x: number; readonly y: number },
  viewport: CameraViewport,
  insets: OcclusionInsets,
  zoom: number,
): { x: number; y: number } {
  const safeZoom = finitePositive(zoom, 1);
  const freeLeft = clamp(insets.left, 0, viewport.width);
  const freeRight = clamp(
    viewport.width - insets.right,
    freeLeft,
    viewport.width,
  );
  const freeTop = clamp(insets.top, 0, viewport.height);
  const freeBottom = clamp(
    viewport.height - insets.bottom,
    freeTop,
    viewport.height,
  );
  const desiredX = (freeLeft + freeRight) / 2;
  const desiredY = (freeTop + freeBottom) / 2;

  return {
    x: target.x - (desiredX - viewport.width / 2) / safeZoom,
    y: target.y - (desiredY - viewport.height / 2) / safeZoom,
  };
}
