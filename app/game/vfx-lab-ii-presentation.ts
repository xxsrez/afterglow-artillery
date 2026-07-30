import {
  getExperimentalPresentation,
  getVfxLabWeapon,
  isVfxLabWeaponId,
  type ExperimentalEffectLevel,
  type PresentationDrawStage,
  type VfxLabWeaponId,
  type Vector2,
} from "../../lib/game";

export interface VfxLabCameraBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface VfxLabViewport {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
}

export interface VfxLabRenderResources {
  snapshot: HTMLCanvasElement | null;
  snapshotKey: string | null;
  sceneCaptures: number;
}

export interface VfxLabShotPresentation {
  readonly weaponId: string;
  readonly seed: number;
  readonly elapsedMs: number;
  readonly duration: number;
  readonly finalPoint: Vector2;
}

export interface DrawVfxLabStageOptions {
  readonly context: CanvasRenderingContext2D;
  readonly stage: PresentationDrawStage;
  readonly shot: VfxLabShotPresentation;
  readonly effectLevel: ExperimentalEffectLevel;
  readonly reducedMotion: boolean;
  readonly viewport: VfxLabViewport;
  readonly cameraBounds: VfxLabCameraBounds;
  readonly impactScreen: Vector2;
  readonly resources: VfxLabRenderResources;
}

const flipbookCache = new Map<string, HTMLCanvasElement>();

export function createVfxLabRenderResources(): VfxLabRenderResources {
  return {
    snapshot: null,
    snapshotKey: null,
    sceneCaptures: 0,
  };
}

export function releaseVfxLabRenderResources(
  resources: VfxLabRenderResources,
): void {
  if (resources.snapshot) {
    resources.snapshot.width = 1;
    resources.snapshot.height = 1;
  }
  resources.snapshot = null;
  resources.snapshotKey = null;
  resources.sceneCaptures = 0;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(value: number): number {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function seededUnit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0xffffffff;
}

function phaseState(
  weaponId: VfxLabWeaponId,
  elapsedMs: number,
): {
  anticipation: number;
  deployment: number;
  climax: number;
  aftermath: number;
  visibility: number;
} {
  const definition = getVfxLabWeapon(weaponId);
  const anticipation = clamp(elapsedMs / definition.anticipationMs);
  const deployment = clamp(
    (elapsedMs - definition.anticipationMs) /
      (definition.resolutionMs - definition.anticipationMs),
  );
  const climaxAt = definition.resolutionMs - 420;
  const climax = clamp(1 - Math.abs(elapsedMs - climaxAt) / 620);
  const aftermath = clamp(
    (elapsedMs - definition.resolutionMs) / definition.aftermathMs,
  );
  const visibility =
    elapsedMs < definition.resolutionMs
      ? smoothstep(deployment)
      : 1 - smoothstep(aftermath);
  return { anticipation, deployment, climax, aftermath, visibility };
}

function drawMechanicContour(
  context: CanvasRenderingContext2D,
  point: Vector2,
  radius: number,
  accent: string,
  secondaryAccent: string,
  alpha: number,
): void {
  context.save();
  context.globalAlpha = clamp(alpha, 0.18, 1);
  context.strokeStyle = secondaryAccent;
  context.lineWidth = 2;
  context.setLineDash([]);
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = accent;
  context.lineWidth = 1.4;
  for (let tick = 0; tick < 8; tick += 1) {
    const angle = (Math.PI * 2 * tick) / 8;
    context.beginPath();
    context.moveTo(
      point.x + Math.cos(angle) * (radius - 3),
      point.y + Math.sin(angle) * (radius - 3),
    );
    context.lineTo(
      point.x + Math.cos(angle) * (radius + 5),
      point.y + Math.sin(angle) * (radius + 5),
    );
    context.stroke();
  }
  context.restore();
}

function drawScreenMechanicCue(
  context: CanvasRenderingContext2D,
  point: Vector2,
  radius: number,
  accent: string,
): void {
  context.save();
  context.strokeStyle = "#f7f6e8";
  context.fillStyle = accent;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(point.x, point.y, Math.max(7, radius), 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(point.x, point.y, 3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function createCelFlipbook(
  accent: string,
  secondaryAccent: string,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  const key = `${accent}:${secondaryAccent}`;
  const cached = flipbookCache.get(key);
  if (cached) {
    return cached;
  }
  const frameSize = 96;
  const frameCount = 6;
  const atlas = document.createElement("canvas");
  atlas.width = frameSize * frameCount;
  atlas.height = frameSize;
  const context = atlas.getContext("2d");
  if (!context) {
    return null;
  }
  for (let frame = 0; frame < frameCount; frame += 1) {
    const x = frame * frameSize + frameSize / 2;
    const growth = 8 + frame * 7.4;
    const lobes = 7;
    context.save();
    context.translate(x, frameSize / 2);
    context.fillStyle = frame < 4 ? accent : `${accent}8c`;
    context.strokeStyle = secondaryAccent;
    context.lineWidth = 2;
    context.beginPath();
    for (let lobe = 0; lobe < lobes * 2; lobe += 1) {
      const angle = (Math.PI * lobe) / lobes;
      const radius = growth * (lobe % 2 === 0 ? 1 : 0.52);
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (lobe === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    }
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
  flipbookCache.set(key, atlas);
  return atlas;
}

function drawCelFrame(
  context: CanvasRenderingContext2D,
  atlas: HTMLCanvasElement,
  frame: number,
  x: number,
  y: number,
  size: number,
): void {
  const frameSize = atlas.height;
  context.drawImage(
    atlas,
    frame * frameSize,
    0,
    frameSize,
    frameSize,
    x - size / 2,
    y - size / 2,
    size,
    size,
  );
}

function drawGear(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  teeth: number,
  rotation: number,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.beginPath();
  for (let tooth = 0; tooth < teeth * 2; tooth += 1) {
    const angle = (Math.PI * tooth) / teeth;
    const currentRadius = tooth % 2 === 0 ? radius : radius * 0.78;
    const px = Math.cos(angle) * currentRadius;
    const py = Math.sin(angle) * currentRadius;
    if (tooth === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }
  context.closePath();
  context.stroke();
  context.beginPath();
  context.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function ensureSnapshot(
  context: CanvasRenderingContext2D,
  resources: VfxLabRenderResources,
  key: string,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  if (
    resources.snapshot &&
    resources.snapshotKey === key &&
    resources.snapshot.width === context.canvas.width &&
    resources.snapshot.height === context.canvas.height
  ) {
    return resources.snapshot;
  }
  releaseVfxLabRenderResources(resources);
  const snapshot = document.createElement("canvas");
  snapshot.width = context.canvas.width;
  snapshot.height = context.canvas.height;
  const snapshotContext = snapshot.getContext("2d");
  if (!snapshotContext) {
    return null;
  }
  snapshotContext.drawImage(context.canvas, 0, 0);
  resources.snapshot = snapshot;
  resources.snapshotKey = key;
  resources.sceneCaptures = 1;
  return snapshot;
}

function drawBehindTheSky(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "behindWorld") {
    return;
  }
  const { context, cameraBounds, shot, effectLevel } = options;
  const definition = getVfxLabWeapon("behindTheSky");
  const atlas = createCelFlipbook(
    definition.accent,
    definition.secondaryAccent,
  );
  if (!atlas) {
    return;
  }
  const frame =
    effectLevel === "reduced"
      ? 3
      : Math.min(5, Math.floor(state.deployment * 6));
  const bloomCount =
    effectLevel === "reduced" ? 1 : effectLevel === "balanced" ? 2 : 3;
  const horizon = cameraBounds.top + cameraBounds.height * 0.58;
  context.save();
  context.globalCompositeOperation = "lighter";
  context.globalAlpha = 0.22 + state.visibility * 0.58;
  for (let bloom = 0; bloom < bloomCount; bloom += 1) {
    const localFrame = Math.max(0, frame - bloom);
    const x =
      cameraBounds.left +
      cameraBounds.width * (0.18 + bloom * 0.31) +
      Math.sin(shot.seed + bloom) * 20;
    const size = cameraBounds.width * (0.28 + bloom * 0.035);
    drawCelFrame(context, atlas, localFrame, x, horizon, size);
  }
  context.restore();
}

function drawBlackPanel(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "screenSpace" || state.deployment <= 0) {
    return;
  }
  const { context, viewport, impactScreen, effectLevel } = options;
  if (effectLevel === "reduced") {
    context.save();
    context.strokeStyle = "#f5f1dc";
    context.lineWidth = 7;
    context.strokeRect(10, 10, viewport.width - 20, viewport.height - 20);
    context.restore();
    return;
  }
  const alpha = state.climax * 0.78;
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#f5f1dc";
  context.beginPath();
  context.moveTo(0, viewport.height * 0.08);
  context.lineTo(viewport.width * 0.92, 0);
  context.lineTo(viewport.width, viewport.height * 0.82);
  context.lineTo(viewport.width * 0.08, viewport.height);
  context.closePath();
  context.fill();
  context.fillStyle = "#101014";
  for (let mass = 0; mass < 5; mass += 1) {
    const x = viewport.width * (0.08 + mass * 0.2);
    const y = viewport.height * (0.18 + (mass % 2) * 0.46);
    context.beginPath();
    context.moveTo(x - 70, y + 38);
    context.lineTo(x + 12, y - 58);
    context.lineTo(x + 98, y + 26);
    context.closePath();
    context.fill();
  }
  context.strokeStyle = "#101014";
  context.lineWidth = 3;
  for (let line = 0; line < 28; line += 1) {
    const angle = (Math.PI * 2 * line) / 28;
    context.beginPath();
    context.moveTo(
      impactScreen.x + Math.cos(angle) * 34,
      impactScreen.y + Math.sin(angle) * 34,
    );
    context.lineTo(
      impactScreen.x + Math.cos(angle) * viewport.width,
      impactScreen.y + Math.sin(angle) * viewport.width,
    );
    context.stroke();
  }
  context.restore();
}

function drawInkTide(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "foreground" || state.deployment <= 0) {
    return;
  }
  const { context, cameraBounds, shot } = options;
  const definition = getVfxLabWeapon("inkTide");
  const rise = Math.sin(state.deployment * Math.PI);
  context.save();
  context.globalAlpha = (0.22 + rise * 0.62) * state.visibility;
  context.fillStyle = definition.accent;
  const left = cameraBounds.left;
  const right = left + cameraBounds.width;
  const top = cameraBounds.top;
  const bottom = top + cameraBounds.height;
  context.beginPath();
  context.moveTo(left, bottom);
  context.bezierCurveTo(
    left + cameraBounds.width * 0.12,
    top + cameraBounds.height * (0.82 - rise * 0.65),
    left + cameraBounds.width * 0.34,
    top + cameraBounds.height * (0.92 - rise * 0.78),
    shot.finalPoint.x,
    shot.finalPoint.y,
  );
  context.bezierCurveTo(
    right - cameraBounds.width * 0.28,
    top + cameraBounds.height * (0.78 - rise * 0.6),
    right - cameraBounds.width * 0.08,
    top + cameraBounds.height * (0.95 - rise * 0.72),
    right,
    bottom,
  );
  context.closePath();
  context.fill();
  context.strokeStyle = definition.secondaryAccent;
  context.lineWidth = 4;
  for (let tendril = 0; tendril < 3; tendril += 1) {
    context.beginPath();
    context.moveTo(shot.finalPoint.x, shot.finalPoint.y);
    context.bezierCurveTo(
      left + cameraBounds.width * (0.18 + tendril * 0.26),
      bottom,
      left + cameraBounds.width * (0.12 + tendril * 0.34),
      top + cameraBounds.height * (0.18 + tendril * 0.08),
      left + cameraBounds.width * (0.08 + tendril * 0.4),
      top + cameraBounds.height * 0.06,
    );
    context.stroke();
  }
  context.restore();
}

function drawThunderWeave(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "behindWorld" || state.deployment <= 0) {
    return;
  }
  const { context, cameraBounds, shot, effectLevel } = options;
  const definition = getVfxLabWeapon("thunderWeave");
  const branches = effectLevel === "reduced" ? 4 : effectLevel === "balanced" ? 10 : 16;
  context.save();
  context.strokeStyle = definition.accent;
  context.lineWidth = effectLevel === "reduced" ? 1.5 : 2.4;
  context.globalAlpha = (0.2 + state.climax * 0.75) * state.visibility;
  for (let branch = 0; branch < branches; branch += 1) {
    const startX =
      cameraBounds.left +
      cameraBounds.width * seededUnit(shot.seed, branch * 3);
    const startY =
      cameraBounds.top +
      cameraBounds.height * 0.05 * seededUnit(shot.seed, branch * 3 + 1);
    const elbowX =
      startX +
      (shot.finalPoint.x - startX) *
        (0.36 + seededUnit(shot.seed, branch * 3 + 2) * 0.3);
    const elbowY =
      cameraBounds.top +
      cameraBounds.height * (0.3 + (branch % 4) * 0.1);
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(elbowX, elbowY);
    context.lineTo(shot.finalPoint.x, shot.finalPoint.y);
    context.stroke();
  }
  context.restore();
}

function drawFilmBurn(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "screenSpace" || state.deployment <= 0) {
    return;
  }
  const { context, viewport, effectLevel } = options;
  if (effectLevel === "reduced") {
    context.save();
    context.strokeStyle = "#ffc857";
    context.lineWidth = 5;
    context.beginPath();
    context.ellipse(
      viewport.width / 2,
      viewport.height / 2,
      viewport.width * 0.32,
      viewport.height * 0.3,
      0.1,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
    return;
  }
  const travel = smoothstep(state.deployment);
  const radius = Math.max(viewport.width, viewport.height) * (0.12 + travel * 0.82);
  context.save();
  context.globalAlpha = state.visibility * 0.42;
  context.fillStyle = "#135270";
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.ellipse(
    viewport.width * (0.08 + travel * 0.84),
    viewport.height * 0.5,
    radius,
    radius * 0.72,
    0.14,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.globalCompositeOperation = "source-over";
  context.strokeStyle = "#ffc857";
  context.globalAlpha = state.visibility * 0.84;
  context.lineWidth = 7;
  context.stroke();
  context.restore();
}

function drawPixelUndertow(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "screenSpace" || state.deployment <= 0) {
    return;
  }
  const { context, viewport, effectLevel, resources, shot } = options;
  if (effectLevel === "reduced") {
    context.save();
    context.strokeStyle = "#74f4d4";
    context.lineWidth = 3;
    context.strokeRect(
      viewport.width * 0.12,
      viewport.height * 0.12,
      viewport.width * 0.76,
      viewport.height * 0.76,
    );
    context.restore();
    return;
  }
  const key = `${shot.weaponId}:${shot.seed}`;
  const snapshot = ensureSnapshot(context, resources, key);
  if (!snapshot) {
    return;
  }
  const columns = effectLevel === "full" ? 8 : 6;
  const rows = 4;
  const sourceWidth = snapshot.width / columns;
  const sourceHeight = snapshot.height / rows;
  const tileWidth = viewport.width / columns;
  const tileHeight = viewport.height / rows;
  const wave = Math.sin(state.deployment * Math.PI);
  context.save();
  context.globalAlpha = 0.92 * state.visibility;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const pull = Math.sin((column / columns) * Math.PI + state.deployment * Math.PI);
      const offsetX = (pull * 18 + (column - columns / 2) * -3) * wave;
      const offsetY = -(12 + row * 7 + (index % 3) * 5) * wave;
      context.drawImage(
        snapshot,
        column * sourceWidth,
        row * sourceHeight,
        sourceWidth,
        sourceHeight,
        column * tileWidth + offsetX,
        row * tileHeight + offsetY,
        tileWidth + 0.5,
        tileHeight + 0.5,
      );
    }
  }
  context.restore();
}

function drawNeonLeviathan(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "behindWorld" || state.deployment <= 0) {
    return;
  }
  const { context, cameraBounds, shot, effectLevel } = options;
  const definition = getVfxLabWeapon("neonLeviathan");
  const travel = effectLevel === "reduced" ? 0.5 : smoothstep(state.deployment);
  const x =
    cameraBounds.left - cameraBounds.width * 0.2 +
    cameraBounds.width * 1.4 * travel;
  const y =
    cameraBounds.top +
    cameraBounds.height * (0.38 + Math.sin(travel * Math.PI * 2) * 0.12);
  context.save();
  context.strokeStyle = definition.accent;
  context.fillStyle = `${definition.secondaryAccent}22`;
  context.globalAlpha = (0.28 + state.climax * 0.62) * state.visibility;
  context.lineWidth = effectLevel === "reduced" ? 4 : 9;
  context.beginPath();
  context.moveTo(x - cameraBounds.width * 0.48, y);
  context.bezierCurveTo(
    x - cameraBounds.width * 0.24,
    y - cameraBounds.height * 0.32,
    x + cameraBounds.width * 0.18,
    y + cameraBounds.height * 0.26,
    x + cameraBounds.width * 0.42,
    y - cameraBounds.height * 0.08,
  );
  context.stroke();
  for (let fin = -2; fin <= 2; fin += 1) {
    const fx = x + fin * cameraBounds.width * 0.11;
    context.beginPath();
    context.moveTo(fx, y);
    context.lineTo(
      fx - cameraBounds.width * 0.055,
      y - cameraBounds.height * (0.12 + Math.abs(fin) * 0.02),
    );
    context.lineTo(fx + cameraBounds.width * 0.04, y - 4);
    context.closePath();
    context.fill();
    context.stroke();
  }
  context.beginPath();
  context.moveTo(x + cameraBounds.width * 0.42, y - cameraBounds.height * 0.08);
  context.lineTo(shot.finalPoint.x, shot.finalPoint.y);
  context.stroke();
  context.restore();
}

function drawShadowJudgment(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "foreground" || state.deployment <= 0) {
    return;
  }
  const { context, cameraBounds, shot } = options;
  const sweep = smoothstep(state.deployment);
  const lightX = cameraBounds.left + cameraBounds.width * sweep;
  context.save();
  context.globalAlpha = 0.18 + state.climax * 0.48;
  context.fillStyle = "#090813";
  for (let shadow = 0; shadow < 5; shadow += 1) {
    const baseX =
      cameraBounds.left + cameraBounds.width * (0.12 + shadow * 0.19);
    const baseY = cameraBounds.top + cameraBounds.height * 0.72;
    const skew = (baseX - lightX) * 0.72;
    context.beginPath();
    context.moveTo(baseX - 18, baseY);
    context.lineTo(baseX + 18, baseY);
    context.lineTo(baseX + skew + 72, cameraBounds.top);
    context.lineTo(baseX + skew - 72, cameraBounds.top);
    context.closePath();
    context.fill();
  }
  context.strokeStyle = "#ffe8a3";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(lightX, cameraBounds.top);
  context.lineTo(shot.finalPoint.x, shot.finalPoint.y);
  context.stroke();
  context.restore();
}

function drawClockworkEclipse(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "behindWorld" || state.deployment <= 0) {
    return;
  }
  const { context, cameraBounds, effectLevel } = options;
  const definition = getVfxLabWeapon("clockworkEclipse");
  const centerX = cameraBounds.left + cameraBounds.width * 0.5;
  const centerY = cameraBounds.top + cameraBounds.height * 0.42;
  const maxRadius = Math.min(cameraBounds.width, cameraBounds.height) * 0.44;
  const gearCount = effectLevel === "reduced" ? 2 : effectLevel === "balanced" ? 4 : 6;
  context.save();
  context.strokeStyle = definition.accent;
  context.globalAlpha = (0.22 + state.climax * 0.66) * state.visibility;
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(centerX, centerY, maxRadius * 1.45, maxRadius, 0, 0, Math.PI * 2);
  context.stroke();
  for (let gear = 0; gear < gearCount; gear += 1) {
    const angle = (Math.PI * 2 * gear) / gearCount;
    const orbit = maxRadius * (0.24 + (gear % 3) * 0.28);
    drawGear(
      context,
      centerX + Math.cos(angle) * orbit,
      centerY + Math.sin(angle) * orbit * 0.55,
      maxRadius * (0.18 + (gear % 2) * 0.08),
      9 + gear,
      state.deployment * Math.PI * (gear % 2 === 0 ? 2 : -2),
    );
  }
  context.restore();
}

function drawInvertedOcean(
  options: DrawVfxLabStageOptions,
  state: ReturnType<typeof phaseState>,
): void {
  if (options.stage !== "foreground" || state.deployment <= 0) {
    return;
  }
  const { context, cameraBounds, shot, effectLevel } = options;
  const definition = getVfxLabWeapon("invertedOcean");
  const descent =
    effectLevel === "reduced" ? 0.38 : Math.sin(state.deployment * Math.PI);
  context.save();
  context.globalCompositeOperation = "screen";
  for (let band = 0; band < 3; band += 1) {
    context.fillStyle =
      band === 1 ? `${definition.secondaryAccent}30` : `${definition.accent}28`;
    context.globalAlpha = state.visibility * (0.44 - band * 0.08);
    const y =
      cameraBounds.top +
      cameraBounds.height * (0.04 + band * 0.11 + descent * 0.34);
    context.beginPath();
    context.moveTo(cameraBounds.left, cameraBounds.top);
    context.lineTo(cameraBounds.left, y);
    for (let point = 0; point <= 8; point += 1) {
      const x = cameraBounds.left + (cameraBounds.width * point) / 8;
      const waveY =
        y +
        Math.sin(point * 1.6 + state.deployment * Math.PI * 2 + band) *
          cameraBounds.height *
          0.045;
      context.lineTo(x, waveY);
    }
    context.lineTo(cameraBounds.left + cameraBounds.width, cameraBounds.top);
    context.closePath();
    context.fill();
  }
  context.strokeStyle = definition.secondaryAccent;
  context.lineWidth = 4;
  for (let caustic = 0; caustic < (effectLevel === "full" ? 12 : 6); caustic += 1) {
    const x =
      cameraBounds.left +
      cameraBounds.width * seededUnit(shot.seed, caustic);
    context.beginPath();
    context.moveTo(x, cameraBounds.top);
    context.quadraticCurveTo(
      x + Math.sin(caustic) * 42,
      cameraBounds.top + cameraBounds.height * 0.3,
      x + Math.cos(caustic) * 60,
      cameraBounds.top + cameraBounds.height * 0.55,
    );
    context.stroke();
  }
  context.globalCompositeOperation = "source-over";
  context.lineWidth = 7;
  context.beginPath();
  context.moveTo(shot.finalPoint.x, cameraBounds.top);
  context.lineTo(shot.finalPoint.x, shot.finalPoint.y);
  context.stroke();
  context.restore();
}

export function drawVfxLabStage(options: DrawVfxLabStageOptions): void {
  if (!isVfxLabWeaponId(options.shot.weaponId)) {
    return;
  }
  const renderOptions =
    options.reducedMotion && options.effectLevel !== "reduced"
      ? ({ ...options, effectLevel: "reduced" } as const)
      : options;
  const weaponId = options.shot.weaponId;
  const presentation = getExperimentalPresentation(weaponId);
  if (!presentation.stages.includes(options.stage)) {
    if (options.stage === "worldOverlay") {
      const definition = getVfxLabWeapon(weaponId);
      const state = phaseState(weaponId, options.shot.elapsedMs);
      drawMechanicContour(
        options.context,
        options.shot.finalPoint,
        definition.footprint.mechanicalRadius,
        definition.accent,
        definition.secondaryAccent,
        0.34 + state.anticipation * 0.66,
      );
    }
    return;
  }
  const state = phaseState(weaponId, options.shot.elapsedMs);
  if (
    state.visibility <= 0.02 &&
    options.shot.elapsedMs >= getVfxLabWeapon(weaponId).resolutionMs
  ) {
    return;
  }
  options.context.save();
  options.context.lineCap = "round";
  options.context.lineJoin = "round";
  switch (presentation.presentationClass) {
    case "background-flipbook-parallax":
      drawBehindTheSky(renderOptions, state);
      break;
    case "graphic-novel-screen-compositor":
      drawBlackPanel(renderOptions, state);
      break;
    case "animated-organic-alpha-matte":
      drawInkTide(renderOptions, state);
      break;
    case "procedural-vector-network":
      drawThunderWeave(renderOptions, state);
      break;
    case "burn-dissolve-mask-transition":
      drawFilmBurn(renderOptions, state);
      break;
    case "scene-snapshot-tile-compositor":
      drawPixelUndertow(renderOptions, state);
      break;
    case "giant-vector-character-path":
      drawNeonLeviathan(renderOptions, state);
      break;
    case "dynamic-silhouette-lighting":
      drawShadowJudgment(renderOptions, state);
      break;
    case "hierarchical-vector-rig":
      drawClockworkEclipse(renderOptions, state);
      break;
    case "layered-atmospheric-caustics":
      drawInvertedOcean(renderOptions, state);
      break;
    default:
      break;
  }
  if (options.stage === "worldOverlay") {
    const definition = getVfxLabWeapon(weaponId);
    drawMechanicContour(
      options.context,
      options.shot.finalPoint,
      definition.footprint.mechanicalRadius,
      definition.accent,
      definition.secondaryAccent,
      0.34 + state.anticipation * 0.66,
    );
  }
  if (
    options.stage === "screenSpace" &&
    state.deployment > 0 &&
    state.visibility > 0.08
  ) {
    const definition = getVfxLabWeapon(weaponId);
    drawScreenMechanicCue(
      options.context,
      options.impactScreen,
      definition.footprint.mechanicalRadius * 0.32,
      definition.accent,
    );
  }
  options.context.restore();
}

export function drawVfxLabMinimapCue(
  context: CanvasRenderingContext2D,
  shot: VfxLabShotPresentation | null,
  scaleX: number,
  scaleY: number,
): void {
  if (!shot || !isVfxLabWeaponId(shot.weaponId)) {
    return;
  }
  const definition = getVfxLabWeapon(shot.weaponId);
  const radius = Math.max(
    3,
    definition.footprint.mechanicalRadius * Math.min(scaleX, scaleY),
  );
  context.save();
  context.strokeStyle = definition.secondaryAccent;
  context.lineWidth = 1.5;
  context.setLineDash([]);
  context.beginPath();
  context.arc(
    shot.finalPoint.x * scaleX,
    shot.finalPoint.y * scaleY,
    radius,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.restore();
}
