import { createStars, STAR_COUNT, STAR_COUNT_HOME, type Star } from './starFactory';
import { drawStar } from './starRenderer';

class StarryBackground {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private stars: Star[] = [];
  private animationId = 0;
  private elapsed = 0;

  private camX = 0;
  private camY = 0;
  private targetCamX = 0;
  private targetCamY = 0;

  private homeMode = true;

  private tendencyDirection = 0;
  private tendencyStrength = 0;

  setTendency(direction: number, strength: number): void {
    this.tendencyDirection = direction;
    this.tendencyStrength = strength;
  }

  setParallax(theta: number, confidence: number): void {
    const maxOffset = 50;
    this.targetCamX = confidence * maxOffset * Math.cos(theta);
    this.targetCamY = confidence * maxOffset * Math.sin(theta);
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
      const newStars = createStars(count - currentCount, cssW, cssH);
      this.stars = this.stars.concat(newStars);
    }
  }

  private resize = (): void => {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // L22：resize 时按当前视口重新分布所有星星，避免旧星星落在视口外或分布不均
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const count = this.homeMode ? STAR_COUNT_HOME : STAR_COUNT;
    this.stars = createStars(count, cssW, cssH);
  };

  private animate = (timestamp: number): void => {
    if (!this.ctx || !this.canvas) return;
    this.elapsed = timestamp;

    this.camX += (this.targetCamX - this.camX) * 0.06;
    this.camY += (this.targetCamY - this.camY) * 0.06;

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const renderCtx = {
      ctx: this.ctx,
      camX: this.camX,
      camY: this.camY,
      time: this.elapsed / 1000,
      homeMode: this.homeMode,
      tendencyDirection: this.tendencyDirection,
      tendencyStrength: this.tendencyStrength,
    };

    for (const s of this.stars) {
      drawStar(s, renderCtx);
    }

    this.animationId = requestAnimationFrame(this.animate);
  };

  init(selector: string): void {
    // 重复 init 时先清理旧 RAF 和监听器，避免多重循环
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
    window.removeEventListener('resize', this.resize);

    const el = document.querySelector(selector) as HTMLCanvasElement;
    if (!el) return;
    this.canvas = el;
    // M21：定位样式由 CSS 统一管理（#starry-canvas 规则），此处不再以 JS 内联设置
    // 避免 JS 未执行时 starry-canvas 以默认 inline 流布局占位破坏页面

    const c = this.canvas.getContext('2d');
    if (!c) return;
    this.ctx = c;

    this.resize();
    window.addEventListener('resize', this.resize);

    this.animationId = requestAnimationFrame(this.animate);
  }

  destroy(): void {
    // L21：cancel 后立即清零 animationId，避免 destroy 后被误判为仍在运行
    cancelAnimationFrame(this.animationId);
    this.animationId = 0;
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
