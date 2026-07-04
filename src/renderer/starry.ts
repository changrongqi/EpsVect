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

class StarryBackground {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stars: Star[] = [];
  private animationId = 0;
  private elapsed = 0;

  private createStar(w: number, h: number): Star {
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

  private drawStar(s: Star, t: number): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
    const alpha = s.baseAlpha * (0.4 + twinkle * 0.6);
    const r = s.radius * (0.8 + twinkle * 0.2);

    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4);
    glow.addColorStop(0, s.color);
    glow.addColorStop(0.3, s.color);
    glow.addColorStop(1, 'transparent');

    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();

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

  private resize = (): void => {
    if (!this.canvas || !this.ctx) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      this.stars.push(this.createStar(this.canvas!.width, this.canvas!.height));
    }
  };

  private animate = (timestamp: number): void => {
    if (!this.ctx || !this.canvas) return;
    const dt = Math.min((timestamp - this.elapsed) / 1000, 0.1);
    this.elapsed = timestamp;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const s of this.stars) {
      this.drawStar(s, this.elapsed / 1000);
    }

    this.animationId = requestAnimationFrame(this.animate);
  };

  init(selector: string): void {
    const el = document.querySelector(selector) as HTMLCanvasElement;
    if (!el) return;
    this.canvas = el;
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.zIndex = '0';
    this.canvas.style.pointerEvents = 'none';

    const c = this.canvas.getContext('2d');
    if (!c) return;
    this.ctx = c;

    this.resize();
    window.addEventListener('resize', this.resize);

    this.animationId = requestAnimationFrame(this.animate);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
    this.canvas = null;
    this.ctx = null;
    this.stars = [];
  }
}

let instance: StarryBackground | null = null;

export function initStarryBackground(selector: string): void {
  if (!instance) {
    instance = new StarryBackground();
  }
  instance.init(selector);
}

export function destroyStarryBackground(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}