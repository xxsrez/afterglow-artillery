import { describe, expect, it } from "vitest";

import {
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  clampCamera,
  clientPointToContainedViewport,
  createCamera,
  flightFocusPoint,
  moveCameraToward,
  panCameraByScreenDelta,
  screenToWorld,
  worldToScreen,
  zoomCameraAtScreenPoint,
} from "../app/game/camera";

const viewport = { width: 960, height: 540 };
const world = { width: 2_880, height: 720 };

describe("large-world camera", () => {
  it("maps a wide contained canvas through horizontal letterboxing", () => {
    const rect = { left: 20, top: 40, width: 1_200, height: 540 };

    expect(
      clientPointToContainedViewport(
        { x: 140, y: 310 },
        rect,
        viewport,
      ),
    ).toEqual({ x: 0, y: 270 });
    expect(
      clientPointToContainedViewport(
        { x: 620, y: 310 },
        rect,
        viewport,
      ),
    ).toEqual({ x: 480, y: 270 });
    expect(
      clientPointToContainedViewport(
        { x: 1_220, y: 310 },
        rect,
        viewport,
      ),
    ).toEqual({ x: 960, y: 270 });
  });

  it("maps a tall contained canvas through vertical letterboxing", () => {
    const rect = { left: 15, top: 25, width: 960, height: 740 };

    expect(
      clientPointToContainedViewport(
        { x: 495, y: 125 },
        rect,
        viewport,
      ),
    ).toEqual({ x: 480, y: 0 });
    expect(
      clientPointToContainedViewport(
        { x: 495, y: 395 },
        rect,
        viewport,
      ),
    ).toEqual({ x: 480, y: 270 });
    expect(
      clientPointToContainedViewport(
        { x: 495, y: 765 },
        rect,
        viewport,
      ),
    ).toEqual({ x: 480, y: 540 });
  });

  it("round-trips between world and screen coordinates", () => {
    const camera = createCamera({ x: 1_640, y: 410 }, viewport, world, 1.24);
    const point = { x: 2_130.5, y: 612.25 };

    const screen = worldToScreen(point, camera, viewport);

    expect(screenToWorld(screen, camera, viewport)).toEqual(point);
  });

  it("clamps all four world edges and centers a world smaller than the view", () => {
    expect(
      clampCamera(
        { center: { x: -900, y: 9_000 }, zoom: 1 },
        viewport,
        world,
      ),
    ).toEqual({
      center: { x: 480, y: 450 },
      zoom: 1,
    });

    expect(
      clampCamera(
        { center: { x: 99_000, y: -400 }, zoom: 1 },
        viewport,
        world,
      ),
    ).toEqual({
      center: { x: 2_400, y: 270 },
      zoom: 1,
    });

    const tiny = clampCamera(
      { center: { x: Number.NaN, y: Number.POSITIVE_INFINITY }, zoom: 0 },
      viewport,
      { width: 320, height: 180 },
    );
    expect(tiny.center).toEqual({ x: 160, y: 90 });
    expect(tiny.zoom).toBe(1);
  });

  it("pans with a grabbed-world gesture and respects zoom limits", () => {
    const camera = createCamera({ x: 1_440, y: 360 }, viewport, world, 1);
    const panned = panCameraByScreenDelta(
      camera,
      { x: 120, y: -60 },
      viewport,
      world,
    );

    expect(panned.center).toEqual({ x: 1_320, y: 420 });

    expect(
      zoomCameraAtScreenPoint(
        camera,
        100,
        { x: 480, y: 270 },
        viewport,
        world,
      ).zoom,
    ).toBe(MAX_CAMERA_ZOOM);
    expect(
      zoomCameraAtScreenPoint(
        camera,
        0.01,
        { x: 480, y: 270 },
        viewport,
        world,
      ).zoom,
    ).toBe(MIN_CAMERA_ZOOM);
  });

  it("keeps the same world point under the pointer while zooming", () => {
    const camera = createCamera({ x: 1_400, y: 380 }, viewport, world, 0.9);
    const anchor = { x: 735, y: 155 };
    const before = screenToWorld(anchor, camera, viewport);
    const zoomed = zoomCameraAtScreenPoint(
      camera,
      1.35,
      anchor,
      viewport,
      world,
    );

    expect(screenToWorld(anchor, zoomed, viewport).x).toBeCloseTo(before.x);
    expect(screenToWorld(anchor, zoomed, viewport).y).toBeCloseTo(before.y);
  });

  it("smoothly approaches an automatic target without overshooting", () => {
    const camera = createCamera({ x: 600, y: 300 }, viewport, world);
    const moved = moveCameraToward(
      camera,
      { x: 2_000, y: 500 },
      1 / 60,
      viewport,
      world,
    );

    expect(moved.center.x).toBeGreaterThan(camera.center.x);
    expect(moved.center.x).toBeLessThan(2_000);
    expect(moved.center.y).toBeGreaterThan(camera.center.y);
    expect(moved.center.y).toBeLessThan(500);
  });

  it("tracks active segments and holds their last meaningful focus", () => {
    const segments = [
      {
        path: [
          { x: 100, y: 300 },
          { x: 500, y: 100 },
        ],
        startsAt: 0.1,
        endsAt: 0.5,
      },
      {
        path: [
          { x: 300, y: 300 },
          { x: 700, y: 100 },
        ],
        startsAt: 0.1,
        endsAt: 0.5,
      },
    ];

    expect(flightFocusPoint(segments, 0.3, { x: 0, y: 0 })).toEqual({
      x: 400,
      y: 200,
    });
    expect(flightFocusPoint(segments, 0.8, { x: 44, y: 55 })).toEqual({
      x: 600,
      y: 100,
    });
  });

  it("interpolates across a flight gap instead of falling back to origin", () => {
    const origin = { x: 100, y: 500 };
    const segments = [
      {
        path: [
          origin,
          { x: 900, y: 180 },
        ],
        startsAt: 0.1,
        endsAt: 0.4,
      },
      {
        path: [
          { x: 1_500, y: 220 },
          { x: 1_700, y: 420 },
        ],
        startsAt: 0.6,
        endsAt: 0.8,
      },
    ];

    expect(flightFocusPoint(segments, 0.5, origin)).toEqual({
      x: 1_200,
      y: 200,
    });
  });
});
