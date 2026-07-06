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
  /** 深度层：0=远景 1=中景 2=近景 */
  depth: 0 | 1 | 2;
}

const STAR_COUNT = 350;
const STAR_COUNT_HOME = 250;
const STAR_COLORS = [
  '#ffffff', // 白色 (主序星)
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#ffffff',
  '#aaccff', // 蓝白 (高温星)
  '#aaccff',
  '#ffe8d0', // 暖黄
  '#ffeedd', // 淡黄
  '#ddeeff', // 浅蓝
  '#e8f0ff', // 微蓝白
  '#fff4e0', // 奶油色
  '#ffcc80', // 橙色
  '#ff88aa', // 粉色
  '#88ffcc', // 青绿
];

/** 按深度层的视差系数：近景动多，远景动少 */
const DEPTH_PARALLAX = [0.08, 0.35, 1.0];
/** 按深度层的亮度系数 */
const DEPTH_ALPHA = [0.45, 0.75, 1.0];
/** 虚拟空间超出视口的边距（px），确保相机偏移不露黑边 */
const VIRTUAL_MARGIN = 250;

class StarryBackground {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stars: Star[] = [];
  private animationId = 0;
  private elapsed = 0;
  /** 相机偏移（当前值） */
  private camX = 0;
  private camY = 0;
  /** 相机偏移（目标值） */
  private targetCamX = 0;
  private targetCamY = 0;
  private guideTheta = 0;
  private guideConfidence = 0;
  private smoothGuideTheta = 0;
  private smoothGuideConfidence = 0;
  private homeMode = true;
  /** 倾向方向（弧度），用于红移/蓝移 */
  private tendencyDirection = 0;
  /** 倾向强度 [0, 1] */
  private tendencyStrength = 0;

  private createStar(w: number, h: number): Star {
    // 深度分层：50%远景，35%中景，15%近景
    const rand = Math.random();
    const depth: 0 | 1 | 2 = rand < 0.5 ? 0 : rand < 0.85 ? 1 : 2;

    // 按深度分配大小和亮度
    let radius: number;
    let baseAlpha: number;
    if (depth === 0) {
      radius = 0.4 + Math.random() * 0.6;
      baseAlpha = 0.3 + Math.random() * 0.4;
    } else if (depth === 1) {
      radius = 1.0 + Math.random() * 0.9;
      baseAlpha = 0.5 + Math.random() * 0.4;
    } else {
      radius = 1.8 + Math.random() * 1.5;
      baseAlpha = 0.8 + Math.random() * 0.2;
    }

    // 虚拟大空间：视口 + 四周各 250px 边距，相机偏移不露黑边
    return {
      x: -VIRTUAL_MARGIN + Math.random() * (w + VIRTUAL_MARGIN * 2),
      y: -VIRTUAL_MARGIN + Math.random() * (h + VIRTUAL_MARGIN * 2),
      radius,
      baseAlpha,
      twinkleSpeed: 0.5 + Math.random() * 3.0,
      twinklePhase: Math.random() * Math.PI * 2,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      depth,
    };
  }

  private drawStar(s: Star, t: number): void {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
    const alphaBoost = DEPTH_ALPHA[s.depth];
    const alpha = s.baseAlpha * (0.4 + twinkle * 0.6) * alphaBoost;
    const r = s.radius * (0.8 + twinkle * 0.2);

    // 相机偏移：所有星星共享同一相机，深度决定视差幅度
    const parallaxFactor = DEPTH_PARALLAX[s.depth];
    const px = s.x + this.camX * parallaxFactor;
    const py = s.y + this.camY * parallaxFactor;

    // 红移/蓝移：计算星星相对于屏幕中心的角度
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const starAngle = Math.atan2(py - cy, px - cx);
    const color = this.shiftColor(s.color, starAngle);

    // 近景星星有柔光，远景星星只是小点
    if (s.depth === 2) {
      // 近景：三层光晕，更灿烂
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
    } else if (s.depth === 1) {
      // 中景：双层光晕增强
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
      // 远景：添加轻微光晕
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

    // 仅算法测试页的近景大星画十字星芒
    if (!this.homeMode && s.depth === 2 && s.baseAlpha > 0.8) {
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

  /** 设置倾向方向（用于红移/蓝移） */
  setTendency(direction: number, strength: number): void {
    this.tendencyDirection = direction;
    this.tendencyStrength = strength;
  }

  /** 红移/蓝移：根据星星相对于倾向方向的角度偏移颜色 */
  private shiftColor(hex: string, starAngle: number): string {
    if (!this.homeMode) return hex;
    if (this.tendencyStrength < 0.03) return hex;
    if (hex.length !== 7) return hex;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // 星星与倾向方向的角度差
    let diff = starAngle - this.tendencyDirection;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    const alignment = Math.cos(diff); // 1=朝向倾向，-1=背离倾向
    const shift = alignment * this.tendencyStrength * 0.6;

    if (shift > 0) {
      // 蓝移：加蓝减红
      return `rgb(${Math.round(r * (1 - shift))}, ${Math.round(g * (1 - shift * 0.4))}, ${Math.round(b + (255 - b) * shift)})`;
    } else {
      // 红移：加红减蓝
      const rs = Math.abs(shift);
      return `rgb(${Math.round(r + (255 - r) * rs)}, ${Math.round(g * (1 - rs * 0.4))}, ${Math.round(b * (1 - rs))})`;
    }
  }

  /** 设置相机偏移方向（由鼠标预测方向驱动） */
  setParallax(theta: number, confidence: number): void {
    const maxOffset = 50;
    this.targetCamX = confidence * maxOffset * Math.cos(theta);
    this.targetCamY = confidence * maxOffset * Math.sin(theta);
    this.guideTheta = theta;
    this.guideConfidence = confidence;
  }

  /** 绘制背景渐变流动光晕：从预测方向涌来 */
  private drawGuideFlow(): void {
    if (!this.homeMode) return;
    if (!this.ctx || !this.canvas) return;
    if (this.smoothGuideConfidence < 0.05) return;

    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const cy = h / 2;

    // 光晕中心：从屏幕中心朝预测方向偏移，制造"光从那边涌来"的感觉
    const distance = Math.max(w, h) * 0.45;
    const edgeX = cx + distance * Math.cos(this.smoothGuideTheta);
    const edgeY = cy + distance * Math.sin(this.smoothGuideTheta);

    const alpha = Math.min(0.3, this.smoothGuideConfidence * 0.35);
    const radius = Math.max(w, h) * 0.5;

    // 单色径向渐变：从预测方向涌来的蓝光
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

  setHomeMode(enabled: boolean): void {
    if (this.homeMode === enabled) return;
    this.homeMode = enabled;
    this.rebuildStars();
  }

  private rebuildStars(): void {
    if (!this.canvas) return;
    const count = this.homeMode ? STAR_COUNT_HOME : STAR_COUNT;
    const currentCount = this.stars.length;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    if (count < currentCount) {
      this.stars = this.stars.slice(0, count);
    } else {
      for (let i = currentCount; i < count; i++) {
        this.stars.push(this.createStar(cssW, cssH));
      }
    }
  }

  private resize = (): void => {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.scale(dpr, dpr);
    this.stars = [];
    const count = this.homeMode ? STAR_COUNT_HOME : STAR_COUNT;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    for (let i = 0; i < count; i++) {
      this.stars.push(this.createStar(cssW, cssH));
    }
  };

  private animate = (timestamp: number): void => {
    if (!this.ctx || !this.canvas) return;
    this.elapsed = timestamp;

    // 相机平滑过渡（惯性感）
    this.camX += (this.targetCamX - this.camX) * 0.06;
    this.camY += (this.targetCamY - this.camY) * 0.06;

    // 引导方向平滑过渡
    this.smoothGuideTheta += this.shortestAngleDiff(this.guideTheta, this.smoothGuideTheta) * 0.12;
    this.smoothGuideConfidence += (this.guideConfidence - this.smoothGuideConfidence) * 0.1;

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // 先绘制背景渐变流动光晕
    this.drawGuideFlow();

    for (const s of this.stars) {
      this.drawStar(s, this.elapsed / 1000);
    }

    this.animationId = requestAnimationFrame(this.animate);
  };

  /** 计算最短角度差（考虑环绕），返回带符号差值 */
  private shortestAngleDiff(target: number, current: number): number {
    let diff = target - current;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }

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

export function setStarryParallax(theta: number, confidence: number): void {
  if (instance) instance.setParallax(theta, confidence);
}

export function setStarryTendency(direction: number, strength: number): void {
  if (instance) instance.setTendency(direction, strength);
}

export function setStarryHomeMode(enabled: boolean): void {
  if (instance) instance.setHomeMode(enabled);
}

export function destroyStarryBackground(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}