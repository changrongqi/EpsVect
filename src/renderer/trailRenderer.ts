import { TrailBuffer, getBufferLength, getBufferPoint } from './trailBuffer';

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

const RAW_COLOR = { r: 255, g: 90, b: 90 };
const SMOOTH_COLOR = { r: 0, g: 220, b: 200 };

export function drawTrailWithFade(
  ctx: CanvasRenderingContext2D,
  trail: TrailBuffer,
  color: { r: number; g: number; b: number },
  minWidth: number,
  maxWidth: number,
): void {
  const len = getBufferLength(trail);
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

export function drawCursor(
  ctx: CanvasRenderingContext2D,
  trail: TrailBuffer,
  color: { r: number; g: number; b: number },
): void {
  const len = getBufferLength(trail);
  if (len === 0) return;
  const last = getBufferPoint(trail, len - 1);

  ctx.beginPath();
  ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawPredictionArrow(ctx: CanvasRenderingContext2D, p: PredictionData): void {
  if (p.speed < 5) return;

  const MIN_ARROW = 30;
  const MAX_ARROW = 150;

  const dx = p.predX - p.fromX;
  const dy = p.predY - p.fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
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

export function drawPredictedPoint(ctx: CanvasRenderingContext2D, p: PredictionData): void {
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

export function drawAlgoTestView(
  ctx: CanvasRenderingContext2D,
  rawTrail: TrailBuffer,
  smoothTrail: TrailBuffer,
  prediction: PredictionData | null,
): void {
  drawTrailWithFade(ctx, rawTrail, RAW_COLOR, 1.0, 3.0);
  drawTrailWithFade(ctx, smoothTrail, SMOOTH_COLOR, 1.5, 4.0);

  if (prediction && prediction.speed >= 5) {
    drawPredictionArrow(ctx, prediction);
    drawPredictedPoint(ctx, prediction);
  }

  drawCursor(ctx, rawTrail, RAW_COLOR);
  drawCursor(ctx, smoothTrail, SMOOTH_COLOR);
}
