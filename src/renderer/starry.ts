import { createStars, STAR_COUNT, STAR_COUNT_HOME, type Star } from './starFactory';
import { drawStar, drawGuideFlow } from './starRenderer';
import { shortestAngleDiff } from '../math/angleUtils';

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

  private guideTheta = 0;
  private guideConfidence = 0;
  private smoothGuideTheta = 0;
  private smoothGuideConfidence = 0;

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
    this.guideTheta = theta;
    this.guideConfidence = confidence;
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
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const count = this.homeMode ? STAR_COUNT_HOME : STAR_COUNT;
    const currentCount = this.stars.length;
    if (count < currentCount) {
      this.stars = this.stars.slice(0, count);
    } else {
      const newStars = createStars(count - currentCount, cssW, cssH);
      this.stars = this.stars.concat(newStars);
    }
  };

  private animate = (timestamp: number): void => {
    if (!this.ctx || !this.canvas) return;
    this.elapsed = timestamp;

    this.camX += (this.targetCamX - this.camX) * 0.06;
    this.camY += (this.targetCamY - this.camY) * 0.06;

    this.smoothGuideTheta += shortestAngleDiff(this.guideTheta, this.smoothGuideTheta) * 0.12;
    this.smoothGuideConfidence += (this.guideConfidence - this.smoothGuideConfidence) * 0.1;

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
