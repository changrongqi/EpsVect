/**
 * Canvas 轨迹渲染器
 * 使用固定长度点队列 + 逐段透明度渐变实现拖尾效果
 * 每帧 clearRect 清空画布，彻底消除鬼影残留
 */

export interface TrailPoint {
  x: number;
  y: number;
}

export interface PredictionData {
  /** 当前平滑坐标（箭头起点） */
  fromX: number;
  fromY: number;
  /** 速度向量 */
  vx: number;
  vy: number;
  /** 预测位置 */
  predX: number;
  predY: number;
  /** 置信度 0~1 */
  confidence: number;
  /** 速度标量 px/s，用于箭头显隐判断 */
  speed: number;
}

interface RendererState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rawTrail: TrailPoint[];
  smoothTrail: TrailPoint[];
  maxTrailLength: number;
  prediction: PredictionData | null;
}

const RAW_COLOR = { r: 255, g: 90, b: 90 };
const SMOOTH_COLOR = { r: 0, g: 220, b: 200 };

let state: RendererState | null = null;

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

  state = { canvas, ctx, rawTrail: [], smoothTrail: [], maxTrailLength, prediction: null };
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

  state.rawTrail.push(raw);
  state.smoothTrail.push(smooth);

  while (state.rawTrail.length > state.maxTrailLength) {
    state.rawTrail.shift();
  }
  while (state.smoothTrail.length > state.maxTrailLength) {
    state.smoothTrail.shift();
  }
}

export function setMaxTrailLength(length: number): void {
  if (!state) return;
  state.maxTrailLength = length;
  // 截断超出部分
  while (state.rawTrail.length > length) state.rawTrail.shift();
  while (state.smoothTrail.length > length) state.smoothTrail.shift();
}

export function getTrailLength(): number {
  if (!state) return 0;
  return state.rawTrail.length;
}

export function setPrediction(data: PredictionData | null): void {
  if (state) state.prediction = data;
}

export function renderFrame(): void {
  if (!state) return;
  const { ctx, rawTrail, smoothTrail, prediction, canvas } = state;
  const w = window.innerWidth;
  const h = window.innerHeight;

  // 完全清空画布，不留任何残留（使用 canvas 实际像素尺寸）
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制轨迹（逐段透明度渐变）
  drawTrailWithFade(ctx, rawTrail, RAW_COLOR, 1.0, 3.0);
  drawTrailWithFade(ctx, smoothTrail, SMOOTH_COLOR, 1.5, 4.0);

  // 绘制预测箭头和预测位置（速度 < 5px/s 时隐藏）
  if (prediction && prediction.speed >= 5) {
    drawPredictionArrow(ctx, prediction);
    drawPredictedPoint(ctx, prediction);
  }

  // 光标圆点最后绘制，始终在最上层且完全不透明
  drawCursor(ctx, rawTrail, RAW_COLOR);
  drawCursor(ctx, smoothTrail, SMOOTH_COLOR);
}

function drawTrailWithFade(
  ctx: CanvasRenderingContext2D,
  trail: TrailPoint[],
  color: { r: number; g: number; b: number },
  minWidth: number,
  maxWidth: number,
): void {
  const len = trail.length;
  if (len < 2) return;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < len; i++) {
    const t = i / len; // 0→1，越靠近头部越不透明
    const alpha = 0.05 + t * 0.95; // 0.05~1.0
    const lw = minWidth + (maxWidth - minWidth) * t;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    ctx.lineWidth = lw;
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
}

function drawCursor(
  ctx: CanvasRenderingContext2D,
  trail: TrailPoint[],
  color: { r: number; g: number; b: number },
): void {
  if (trail.length === 0) return;
  const last = trail[trail.length - 1];

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

  // 计算预测点到起点的距离和方向
  const dx = p.predX - p.fromX;
  const dy = p.predY - p.fromY;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.01) return;
  const angle = Math.atan2(dy, dx);

  // 限制箭头长度
  const clamped = Math.max(MIN_ARROW, Math.min(MAX_ARROW, dist));
  const endX = p.fromX + Math.cos(angle) * clamped;
  const endY = p.fromY + Math.sin(angle) * clamped;

  // 透明度：保底 0.3，置信度越高越不透明
  const alpha = Math.min(1, 0.3 + p.confidence * 0.7);
  const lineWidth = 2.5 + p.confidence * 1.0;

  // 发光效果
  ctx.save();
  ctx.shadowColor = 'rgba(255, 200, 0, 0.6)';
  ctx.shadowBlur = 8 + p.confidence * 6;

  // 箭头主线
  ctx.beginPath();
  ctx.strokeStyle = `rgba(255, 220, 80, ${alpha})`;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.moveTo(p.fromX, p.fromY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // 箭头头部
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
  // 透明度：保底 0.4
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