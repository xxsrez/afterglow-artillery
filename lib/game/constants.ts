/**
 * Full logical battlefield dimensions used by simulation, terrain generation
 * and world-space presentation.
 */
export const WORLD_WIDTH = 2_880;
export const WORLD_HEIGHT = 720;

/**
 * Visible logical viewport. Presentation may pan and zoom over the larger
 * battlefield while keeping a stable control surface for HUD and touch input.
 */
export const VIEWPORT_WIDTH = 960;
export const VIEWPORT_HEIGHT = 540;

/** Prototype physics defaults expressed in logical world units. */
export const DEFAULT_GRAVITY = 180;
export const DEFAULT_TIME_STEP = 1 / 60;
export const DEFAULT_MAX_SHOT_TIME = 12;
export const DEFAULT_POWER_SCALE = 0.75;
