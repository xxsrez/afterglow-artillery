import { pointAlongPath, type Vector2 } from "../../lib/game";

export { pointAlongPath };

export const MIN_CAMERA_ZOOM = 0.72;
export const MAX_CAMERA_ZOOM = 1.55;

export interface CameraState {
  readonly center: Vector2;
  readonly zoom: number;
}

export interface CameraViewport {
  readonly width: number;
  readonly height: number;
}

export interface CameraWorld {
  readonly width: number;
  readonly height: number;
}

export interface CanvasClientRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraFlightSegment {
  readonly path: readonly Vector2[];
  readonly startsAt: number;
  readonly endsAt: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Converts a CSS client coordinate into the fixed logical canvas viewport.
 * `object-fit: contain` can leave horizontal or vertical letterboxing inside
 * the element box, so scaling against the whole DOMRect would skew camera
 * gestures on wide phones and tall containers.
 */
export function clientPointToContainedViewport(
  clientPoint: Vector2,
  clientRect: CanvasClientRect,
  viewport: CameraViewport,
): Vector2 {
  const viewportWidth = finitePositive(viewport.width, 1);
  const viewportHeight = finitePositive(viewport.height, 1);
  const rectWidth = finitePositive(clientRect.width, viewportWidth);
  const rectHeight = finitePositive(clientRect.height, viewportHeight);
  const rectLeft = Number.isFinite(clientRect.left) ? clientRect.left : 0;
  const rectTop = Number.isFinite(clientRect.top) ? clientRect.top : 0;
  const scale = Math.max(
    0.000_001,
    Math.min(
      rectWidth / viewportWidth,
      rectHeight / viewportHeight,
    ),
  );
  const contentWidth = viewportWidth * scale;
  const contentHeight = viewportHeight * scale;
  const contentLeft = rectLeft + (rectWidth - contentWidth) / 2;
  const contentTop = rectTop + (rectHeight - contentHeight) / 2;
  const clientX = Number.isFinite(clientPoint.x)
    ? clientPoint.x
    : contentLeft;
  const clientY = Number.isFinite(clientPoint.y)
    ? clientPoint.y
    : contentTop;

  return {
    x: clamp((clientX - contentLeft) / scale, 0, viewportWidth),
    y: clamp((clientY - contentTop) / scale, 0, viewportHeight),
  };
}

export function clampCameraZoom(zoom: number): number {
  return clamp(
    finitePositive(zoom, 1),
    MIN_CAMERA_ZOOM,
    MAX_CAMERA_ZOOM,
  );
}

function clampedCenterAxis(
  center: number,
  viewportSize: number,
  worldSize: number,
  zoom: number,
): number {
  const safeWorldSize = finitePositive(worldSize, 1);
  const visibleHalf = finitePositive(viewportSize, 1) / (2 * zoom);

  if (safeWorldSize <= visibleHalf * 2) {
    return safeWorldSize / 2;
  }

  return clamp(
    Number.isFinite(center) ? center : safeWorldSize / 2,
    visibleHalf,
    safeWorldSize - visibleHalf,
  );
}

export function clampCamera(
  camera: CameraState,
  viewport: CameraViewport,
  world: CameraWorld,
): CameraState {
  const zoom = clampCameraZoom(camera.zoom);

  return {
    center: {
      x: clampedCenterAxis(
        camera.center.x,
        viewport.width,
        world.width,
        zoom,
      ),
      y: clampedCenterAxis(
        camera.center.y,
        viewport.height,
        world.height,
        zoom,
      ),
    },
    zoom,
  };
}

export function createCamera(
  target: Vector2,
  viewport: CameraViewport,
  world: CameraWorld,
  zoom = 1,
): CameraState {
  return clampCamera({ center: { ...target }, zoom }, viewport, world);
}

export function worldToScreen(
  point: Vector2,
  camera: CameraState,
  viewport: CameraViewport,
): Vector2 {
  return {
    x:
      (point.x - camera.center.x) * camera.zoom +
      viewport.width / 2,
    y:
      (point.y - camera.center.y) * camera.zoom +
      viewport.height / 2,
  };
}

export function screenToWorld(
  point: Vector2,
  camera: CameraState,
  viewport: CameraViewport,
): Vector2 {
  const zoom = clampCameraZoom(camera.zoom);

  return {
    x: camera.center.x + (point.x - viewport.width / 2) / zoom,
    y: camera.center.y + (point.y - viewport.height / 2) / zoom,
  };
}

/**
 * A positive screen delta means the grabbed world moved right/down under the
 * pointer, so the camera center moves in the opposite direction.
 */
export function panCameraByScreenDelta(
  camera: CameraState,
  delta: Vector2,
  viewport: CameraViewport,
  world: CameraWorld,
): CameraState {
  const zoom = clampCameraZoom(camera.zoom);

  return clampCamera(
    {
      center: {
        x: camera.center.x - delta.x / zoom,
        y: camera.center.y - delta.y / zoom,
      },
      zoom,
    },
    viewport,
    world,
  );
}

/**
 * Zooms around a screen-space anchor while preserving the world point under
 * that anchor.
 */
export function zoomCameraAtScreenPoint(
  camera: CameraState,
  nextZoom: number,
  anchor: Vector2,
  viewport: CameraViewport,
  world: CameraWorld,
): CameraState {
  const anchoredWorldPoint = screenToWorld(anchor, camera, viewport);
  const zoom = clampCameraZoom(nextZoom);
  const nextCamera = {
    center: {
      x:
        anchoredWorldPoint.x -
        (anchor.x - viewport.width / 2) / zoom,
      y:
        anchoredWorldPoint.y -
        (anchor.y - viewport.height / 2) / zoom,
    },
    zoom,
  };

  return clampCamera(nextCamera, viewport, world);
}

export function moveCameraToward(
  camera: CameraState,
  target: Vector2,
  deltaSeconds: number,
  viewport: CameraViewport,
  world: CameraWorld,
  responsiveness = 7.5,
): CameraState {
  const safeDelta = clamp(
    Number.isFinite(deltaSeconds) ? deltaSeconds : 0,
    0,
    0.1,
  );
  const safeResponsiveness = Math.max(
    0,
    Number.isFinite(responsiveness) ? responsiveness : 0,
  );
  const progress = 1 - Math.exp(-safeDelta * safeResponsiveness);

  return clampCamera(
    {
      center: {
        x: camera.center.x + (target.x - camera.center.x) * progress,
        y: camera.center.y + (target.y - camera.center.y) * progress,
      },
      zoom: camera.zoom,
    },
    viewport,
    world,
  );
}

export function averagePoints(
  points: readonly Vector2[],
  fallback: Vector2,
): Vector2 {
  if (points.length === 0) {
    return { ...fallback };
  }

  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

export function flightFocusPoint(
  segments: readonly CameraFlightSegment[],
  progress: number,
  fallback: Vector2,
): Vector2 {
  const activePoints = segments.flatMap((segment) => {
    if (progress < segment.startsAt || progress > segment.endsAt) {
      return [];
    }

    const duration = Math.max(0.000_001, segment.endsAt - segment.startsAt);
    const point = pointAlongPath(
      segment.path,
      (progress - segment.startsAt) / duration,
    );

    return point === null ? [] : [point];
  });

  return averagePoints(activePoints, fallback);
}
