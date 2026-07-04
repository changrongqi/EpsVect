/**
 * 星空背景渲染器
 * 绘制真实的星空背景，包括闪烁、大小变化和色温差异
 */

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
}

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let stars: Star[] = [];
let animationId = 0;
let elapsed = 0;

const STAR_COUNT = 300;
const STAR_COLORS = [
  '#ffffff', // 白色 (主序星)
  '#aaccff', // 蓝白 (高温星)
  '#ffe8d0', // 暖黄
  '#ffeedd', // 淡黄
  '#ddeeff', // 浅蓝
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#e8f0ff', // 微蓝白
  '#fff4e0', // 奶油色
];

function createStar(w: number, h: number): Star {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    radius: 0.3 + Math.random() * 2.2,
    baseAlpha: 0.3 + Math.random() * 0.7,
    twinkleSpeed: 0.5 + Math.random() * 3.0,
    twinklePhase: Math.random() * Math.PI * 2,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
  };
}

function drawStar(s: Star, t: number): void {
  const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
  const alpha = s.baseAlpha * (0.4 + twinkle * 0.6);
  const r = s.radius * (0.8 + twinkle * 0.2);

  // 光晕
  const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4);
  glow.addColorStop(0, s.color);
  glow.addColorStop(0.3, s.color);
  glow.addColorStop(1, 'transparent');

  ctx.globalAlpha = alpha * 0.3;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r * 4, 0, Math.PI * 2);
  ctx.fill();

  // 核心亮点
  ctx.globalAlpha = alpha;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fill();

  // 十字光芒（仅对亮星）
  if (s.baseAlpha > 0.7 && s.radius > 1.2) {
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 0.5;
    const len = r * 3;
    ctx.beginPath();
    ctx.moveTo(s.x - len, s.y);
    ctx.lineTo(s.x + len, s.y);
    ctx.moveTo(s.x, s.y - len);
    ctx.lineTo(s.x, s.y + len);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push(createStar(canvas.width, canvas.height));
  }
}

function animate(timestamp: number): void {
  const dt = Math.min((timestamp - elapsed) / 1000, 0.1);
  elapsed = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const s of stars) {
    drawStar(s, elapsed / 1000);
  }

  animationId = requestAnimationFrame(animate);
}

export function initStarryBackground(selector: string): void {
  const el = document.querySelector(selector) as HTMLCanvasElement;
  if (!el) return;
  canvas = el;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '0';
  canvas.style.pointerEvents = 'none';

  const c = canvas.getContext('2d');
  if (!c) return;
  ctx = c;

  resize();
  window.addEventListener('resize', resize);

  animationId = requestAnimationFrame(animate);
}

export function destroyStarryBackground(): void {
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', resize);
}