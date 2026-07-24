import type { Star } from './starFactory';

const DEPTH_PARALLAX = [0.08, 0.35, 1.0];
const DEPTH_ALPHA = [0.45, 0.75, 1.0];

export interface StarRenderContext {
  ctx: CanvasRenderingContext2D;
  camX: number;
  camY: number;
  time: number;
  homeMode: boolean;
  tendencyDirection: number;
  tendencyStrength: number;
}

export function drawStar(s: Star, ctx: StarRenderContext): void {
  const { ctx: c, camX, camY, time, homeMode, tendencyDirection, tendencyStrength } = ctx;
  const twinkle = 0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinklePhase);
  const alphaBoost = DEPTH_ALPHA[s.depth];
  const alpha = s.baseAlpha * (0.4 + twinkle * 0.6) * alphaBoost;
  const r = s.radius * (0.8 + twinkle * 0.2);

  const parallaxFactor = DEPTH_PARALLAX[s.depth];
  const px = s.x + camX * parallaxFactor;
  const py = s.y + camY * parallaxFactor;

  const color = homeMode
    ? shiftColor(s.color, px, py, tendencyDirection, tendencyStrength)
    : s.color;

  drawStarByDepth(c, px, py, r, alpha, color, s.depth, s.baseAlpha, !homeMode);
}

function drawStarByDepth(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  r: number,
  alpha: number,
  color: string,
  depth: 0 | 1 | 2,
  baseAlpha: number,
  drawSpikes: boolean,
): void {
  if (depth === 2) {
    ctx.globalAlpha = alpha * 0.15;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, r * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath();
    ctx.arc(px, py, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    if (drawSpikes && baseAlpha > 0.8) {
      ctx.globalAlpha = alpha * 0.3;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      const len = r * 3;
      ctx.beginPath();
      ctx.moveTo(px - len, py);
      ctx.lineTo(px + len, py);
      ctx.moveTo(px, py - len);
      ctx.lineTo(px, py + len);
      ctx.stroke();
    }
  } else if (depth === 1) {
    ctx.globalAlpha = alpha * 0.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, r * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = alpha * 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, r * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function shiftColor(
  hex: string,
  px: number,
  py: number,
  tendencyDirection: number,
  tendencyStrength: number,
): string {
  if (tendencyStrength < 0.03) return hex;
  if (hex.length !== 7) return hex;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const starAngle = Math.atan2(py - cy, px - cx);

  let diff = starAngle - tendencyDirection;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  const alignment = Math.cos(diff);
  const shift = alignment * tendencyStrength * 0.6;

  if (shift > 0) {
    return `rgb(${Math.round(r * (1 - shift))}, ${Math.round(g * (1 - shift * 0.4))}, ${Math.round(b + (255 - b) * shift)})`;
  } else {
    const rs = Math.abs(shift);
    return `rgb(${Math.round(r + (255 - r) * rs)}, ${Math.round(g * (1 - rs * 0.4))}, ${Math.round(b * (1 - rs))})`;
  }
}

export function drawGuideFlow(
  ctx: CanvasRenderingContext2D,
  smoothGuideTheta: number,
  smoothGuideConfidence: number,
): void {
  if (smoothGuideConfidence < 0.05) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;

  const distance = Math.max(w, h) * 0.45;
  const edgeX = cx + distance * Math.cos(smoothGuideTheta);
  const edgeY = cy + distance * Math.sin(smoothGuideTheta);

  const alpha = Math.min(0.3, smoothGuideConfidence * 0.35);
  const radius = Math.max(w, h) * 0.5;

  const gradient = ctx.createRadialGradient(edgeX, edgeY, 0, edgeX, edgeY, radius);
  gradient.addColorStop(0, `rgba(100, 180, 255, ${alpha})`);
  gradient.addColorStop(0.5, `rgba(80, 140, 220, ${alpha * 0.4})`);
  gradient.addColorStop(1, 'rgba(100, 180, 255, 0)');

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
