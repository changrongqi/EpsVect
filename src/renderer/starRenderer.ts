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
  // 用径向渐变替代多层实心圆叠加，让亮度从中心到边缘连续衰减，消除硬边界阶跃。
  // 保持原有逻辑：各深度的光晕半径比例（depth2=4r / depth1=2.5r / depth0=2r）、
  // 核心高亮、depth2 大星的十字光芒。alpha 直接编码到 rgba 中，globalAlpha 恒为 1。
  const rgb = parseColor(color);
  const { r: rr, g: gg, b: bb } = rgb;

  let haloR: number;
  if (depth === 2) {
    haloR = r * 4;
  } else if (depth === 1) {
    haloR = r * 2.5;
  } else {
    haloR = r * 2;
  }

  const grad = ctx.createRadialGradient(px, py, 0, px, py, haloR);
  // stops 设计：核心区（0~核心边缘）保持高 alpha，光晕区连续衰减到 0。
  // 各 depth 的中间 stop 位置对齐原多层圆的边界（r/haloR、2.2r/4r 等），
  // 但 alpha 连续过渡而非阶跃。
  if (depth === 2) {
    grad.addColorStop(0, `rgba(${rr}, ${gg}, ${bb}, ${alpha})`);
    grad.addColorStop(0.25, `rgba(${rr}, ${gg}, ${bb}, ${alpha * 0.9})`);
    grad.addColorStop(0.55, `rgba(${rr}, ${gg}, ${bb}, ${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(${rr}, ${gg}, ${bb}, 0)`);
  } else if (depth === 1) {
    grad.addColorStop(0, `rgba(${rr}, ${gg}, ${bb}, ${alpha})`);
    grad.addColorStop(0.4, `rgba(${rr}, ${gg}, ${bb}, ${alpha * 0.55})`);
    grad.addColorStop(1, `rgba(${rr}, ${gg}, ${bb}, 0)`);
  } else {
    grad.addColorStop(0, `rgba(${rr}, ${gg}, ${bb}, ${alpha})`);
    grad.addColorStop(0.5, `rgba(${rr}, ${gg}, ${bb}, ${alpha * 0.35})`);
    grad.addColorStop(1, `rgba(${rr}, ${gg}, ${bb}, 0)`);
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, haloR, 0, Math.PI * 2);
  ctx.fill();

  // depth 2 大星的十字光芒保留（独立于渐变，沿用原 globalAlpha 方式）
  if (depth === 2 && drawSpikes && baseAlpha > 0.8) {
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

  ctx.globalAlpha = 1;
}

/**
 * 解析颜色字符串为 RGB 分量。
 * 支持 hex（#ffffff，Star.color 原始格式）与 rgb()（shiftColor 动态返回）两种格式。
 */
function parseColor(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    return {
      r: parseInt(color.slice(1, 3), 16),
      g: parseInt(color.slice(3, 5), 16),
      b: parseInt(color.slice(5, 7), 16),
    };
  }
  const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
    };
  }
  return { r: 255, g: 255, b: 255 };
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
