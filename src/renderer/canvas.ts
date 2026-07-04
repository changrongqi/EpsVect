/**
 * Canvas 轨迹渲染器
 * 使用固定长度环形缓冲区 + 逐段透明度渐变实现拖尾效果
 * 每帧 clearRect 清空画布，彻底消除鬼影残留
 */

export interface TrailPoint {
  x: number;
  y: number;
}

export interface PredictionData {
  fromX: number;
  fromY: number;
  vx: number;
  vy: number;
  predX: number;
  predY: number;
  confidence: number;
  speed: number;
}

interface TrailBuffer {
  points: TrailPoint[];
  writeIdx: number;
  count: number;
}

interface RendererState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rawTrail: TrailBuffer;
  smoothTrail: TrailBuffer;
  maxTrailLength: number;
  prediction: PredictionData | null;
}

const RAW_COLOR = { r: 255, g: 90, b: 90 };
const SMOOTH_COLOR = { r: 0, g: 220, b: 200 };

let state: RendererState | null = null;

function createTrailBuffer(maxLength: number): TrailBuffer {
  return {
    points: new Array<TrailPoint>(maxLength),
    writeIdx: 0,
    count: 0,
  };
}

function pushToBuffer(buffer: TrailBuffer, point: TrailPoint): void {
  buffer.points[buffer.writeIdx] = point;
  buffer.writeIdx = (buffer.writeIdx + 1) % buffer.points.length;
  if (buffer.count < buffer.points.length) buffer.count++;
}

function getBufferLength(buffer: TrailBuffer): number {
  return buffer.count;
}

function getBufferPoint(buffer: TrailBuffer, index: number): TrailPoint {
  const idx = (buffer.writeIdx - buffer.count + index + buffer.points.length) % buffer.points.length;
  return buffer.points[idx];
}

export function initRenderer(
  canvasSelector: string,
  maxTrailLength: number = 100,
): CanvasRenderingContext2D {
  const canvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
  if (!canvas) throw new Error(`Canvas not found: ${canvasSelector}`);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context not available');

  resizeCanvas(canvas, ctx);
  window.addEventListener('resize', () => resizeCanvas(canvas, ctx));

  state = {
    canvas,
    ctx,
    rawTrail: createTrailBuffer(maxTrailLength),
    smoothTrail: createTrailBuffer(maxTrailLength),
    maxTrailLength,
    prediction: null,
  };
  return ctx;
}

function resizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr);
}

export function pushTrailPoint(raw: TrailPoint, smooth: TrailPoint): void {
  if (!state) return;
  pushToBuffer(state.rawTrail, raw);
  pushToBuffer(state.smoothTrail, smooth);
}

export function setMaxTrailLength(length: number): void {
  if (!state) return;

  if (length !== state.maxTrailLength) {
    const newRaw = createTrailBuffer(length);
    const newSmooth = createTrailBuffer(length);

    const copyCount = Math.min(state.rawTrail.count, length);
    for (let i = 0; i < copyCount; i++) {
      newRaw.points[i] = getBufferPoint(state.rawTrail, i);
      newSmooth.points[i] = getBufferPoint(state.smoothTrail, i);
    }
    newRaw.writeIdx = copyCount % length;
    newRaw.count = copyCount;
    newSmooth.writeIdx = copyCount % length;
    newSmooth.count = copyCount;

    state.rawTrail = newRaw;
    state.smoothTrail = newSmooth;
    state.maxTrailLength = length;
  }
}

export function getTrailLength(): number {
  if (!state) return 0;
  return getBufferLength(state.rawTrail);
}

export function setPrediction(data: PredictionData | null): void {
  if (state) state.prediction = data;
}

export function renderFrame(): void {
  if (!state) return;
  const { ctx, rawTrail, smoothTrail, prediction, canvas } = state;
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawTrailWithFade(ctx, rawTrail, RAW_COLOR, 1.0, 3.0);
  drawTrailWithFade(ctx, smoothTrail, SMOOTH_COLOR, 1.5, 4.0);

  if (prediction && prediction.speed >= 5) {
    drawPredictionArrow(ctx, prediction);
    drawPredictedPoint(ctx, prediction);
  }

  drawCursor(ctx, rawTrail, RAW_COLOR);
  drawCursor(ctx, smoothTrail, SMOOTH_COLOR);
}

function drawTrailWithFade(
  ctx: CanvasRenderingContext2D,
  trail: TrailBuffer,
  color: { r: number; g: number; b: number },
  minWidth: number,
  maxWidth: number,
): void {
  const len = trail.count;
  if (len < 2) return;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < len; i++) {
    const t = i / len;
    const alpha = 0.05 + t * 0.95;
    const lw = minWidth + (maxWidth - minWidth) * t;

    const prev = getBufferPoint(trail, i - 1);
    const curr = getBufferPoint(trail, i);

    ctx.beginPath();
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    ctx.lineWidth = lw;
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }
}

function drawCursor(
  ctx: CanvasRenderingContext2D,
  trail: TrailBuffer,
  color: { r: number; g: number; b: number },
): void {
  if (trail.count === 0) return;
  const last = getBufferPoint(trail, trail.count - 1);

  ctx.beginPath();
  ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawPredictionArrow(ctx: CanvasRenderingContext2D, p: PredictionData): void {
  if (p.speed < 5) return;

  const MIN_ARROW = 30;
  const MAX_ARROW = 150;

  const dx = p.predX - p.fromX;
  const dy = p.predY - p.fromY;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.01) return;
  const angle = Math.atan2(dy, dx);

  const clamped = Math.max(MIN_ARROW, Math.min(MAX_ARROW, dist));
  const endX = p.fromX + Math.cos(angle) * clamped;
  const endY = p.fromY + Math.sin(angle) * clamped;

  const alpha = Math.min(1, 0.3 + p.confidence * 0.7);
  const lineWidth = 2.5 + p.confidence * 1.0;

  ctx.save();
  ctx.shadowColor = 'rgba(255, 200, 0, 0.6)';
  ctx.shadowBlur = 8 + p.confidence * 6;

  ctx.beginPath();
  ctx.strokeStyle = `rgba(255, 220, 80, ${alpha})`;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.moveTo(p.fromX, p.fromY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const headLen = 10 + p.confidence * 6;
  const headAngle = Math.PI / 6;

  ctx.beginPath();
  ctx.fillStyle = `rgba(255, 220, 80, ${alpha})`;
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLen * Math.cos(angle - headAngle),
    endY - headLen * Math.sin(angle - headAngle),
  );
  ctx.lineTo(
    endX - headLen * Math.cos(angle + headAngle),
    endY - headLen * Math.sin(angle + headAngle),
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPredictedPoint(ctx: CanvasRenderingContext2D, p: PredictionData): void {
  const alpha = Math.min(1, 0.4 + p.confidence * 0.6);
  const radius = 4 + p.confidence * 5;

  ctx.save();
  ctx.shadowColor = 'rgba(255, 200, 0, 0.5)';
  ctx.shadowBlur = 6 + p.confidence * 6;

  ctx.beginPath();
  ctx.arc(p.predX, p.predY, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 220, 80, ${alpha})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}