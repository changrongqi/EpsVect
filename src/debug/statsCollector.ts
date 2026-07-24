import { createRingBuffer, pushRing, getRingCount, getRingAt } from '../util/ringBuffer';
import { avg, stdDev } from '../math/angleUtils';

export interface StatsSample {
  time: number;
  speed: number;
  lagDeg: number;
  confidence: number;
  fps: number;
  predError: number;
}

export interface StatsSummary {
  speedAvg: number;
  speedMax: number;
  speedMin: number;
  speedStd: number;
  lagAvg: number;
  lagMax: number;
  lagMin: number;
  confAvg: number;
  confMax: number;
  confMin: number;
  predErrorAvg: number;
  predErrorMax: number;
  predErrorMin: number;
  fpsAvg: number;
  fpsMax: number;
  fpsMin: number;
}

export class StatsCollector {
  private readonly windowMs: number;
  private readonly buffer = createRingBuffer<StatsSample>(600);
  private prevSmoothX = 0;
  private prevSmoothY = 0;
  private prevTime = 0;
  private hasPrevSmooth = false;

  constructor(windowMs: number = 1000, capacity: number = 600) {
    this.windowMs = windowMs;
    this.buffer = createRingBuffer<StatsSample>(capacity);
  }

  record(
    speed: number,
    lagDeg: number,
    confidence: number,
    fps: number,
    smoothX: number,
    smoothY: number,
    predX: number,
    predY: number,
  ): number {
    const now = performance.now();
    const predError = this.computePredError(speed, smoothX, smoothY, predX, predY, now);

    this.prevSmoothX = smoothX;
    this.prevSmoothY = smoothY;
    this.prevTime = now;
    this.hasPrevSmooth = true;

    pushRing(this.buffer, {
      time: performance.now(),
      speed,
      lagDeg,
      confidence,
      fps,
      predError,
    });

    return predError;
  }

  private computePredError(
    speed: number,
    smoothX: number,
    smoothY: number,
    predX: number,
    predY: number,
    now: number,
  ): number {
    if (!this.hasPrevSmooth || speed < 5) return 0;

    const actualDx = smoothX - this.prevSmoothX;
    const actualDy = smoothY - this.prevSmoothY;
    const predDx = predX - smoothX;
    const predDy = predY - smoothY;
    // 使用实际帧间隔计算预测误差，兜底 16ms
    const dtMs = Math.max(1, now - this.prevTime);
    const timeRatio = Math.min(1, dtMs / 100);
    const expectedDx = predDx * timeRatio;
    const expectedDy = predDy * timeRatio;
    const dx = actualDx - expectedDx;
    const dy = actualDy - expectedDy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  summarize(): StatsSummary {
    const now = performance.now();
    const cutoff = now - this.windowMs;
    const speeds: number[] = [];
    const lags: number[] = [];
    const confs: number[] = [];
    const predErrs: number[] = [];
    const fpsValues: number[] = [];

    const count = getRingCount(this.buffer);
    for (let i = 0; i < count; i++) {
      const s = getRingAt(this.buffer, i);
      if (s.time < cutoff) continue;

      speeds.push(s.speed);
      lags.push(s.lagDeg);
      confs.push(s.confidence);
      if (s.predError > 0) predErrs.push(s.predError);
      if (s.fps > 0) fpsValues.push(s.fps);
    }

    const speedAvg = avg(speeds);
    return {
      speedAvg,
      speedMax: speeds.length === 0 ? 0 : Math.max(...speeds),
      speedMin: speeds.length === 0 ? 0 : Math.min(...speeds),
      speedStd: stdDev(speeds, speedAvg),
      lagAvg: avg(lags),
      lagMax: lags.length === 0 ? 0 : Math.max(...lags),
      lagMin: lags.length === 0 ? 0 : Math.min(...lags),
      confAvg: avg(confs),
      confMax: confs.length === 0 ? 0 : Math.max(...confs),
      confMin: confs.length === 0 ? 0 : Math.min(...confs),
      predErrorAvg: avg(predErrs),
      predErrorMax: predErrs.length === 0 ? 0 : Math.max(...predErrs),
      predErrorMin: predErrs.length === 0 ? 0 : Math.min(...predErrs),
      fpsAvg: avg(fpsValues),
      fpsMax: fpsValues.length === 0 ? 0 : Math.max(...fpsValues),
      fpsMin: fpsValues.length === 0 ? 0 : Math.min(...fpsValues),
    };
  }
}
