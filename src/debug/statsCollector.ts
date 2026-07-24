import { createRingBuffer, pushRing, getRingCount, getRingAt, type RingBuffer } from '../util/ringBuffer';
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

// L31：空摘要常量，summarize 在无数据时直接返回，避免 avg/stdDev 对空数组返回 NaN
const EMPTY_SUMMARY: StatsSummary = {
  speedAvg: 0, speedMax: 0, speedMin: 0, speedStd: 0,
  lagAvg: 0, lagMax: 0, lagMin: 0,
  confAvg: 0, confMax: 0, confMin: 0,
  predErrorAvg: 0, predErrorMax: 0, predErrorMin: 0,
  fpsAvg: 0, fpsMax: 0, fpsMin: 0,
};

export class StatsCollector {
  private readonly windowMs: number;
  // L30：声明处不初始化，由构造函数统一赋值，避免 600 与 capacity 不一致
  private readonly buffer: RingBuffer<StatsSample>;
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
    // L32：now 复用，避免在 record 内重复调用 performance.now()
    const now = performance.now();
    const predError = this.computePredError(speed, smoothX, smoothY, predX, predY, now);

    this.prevSmoothX = smoothX;
    this.prevSmoothY = smoothY;
    this.prevTime = now;
    this.hasPrevSmooth = true;

    pushRing(this.buffer, {
      time: now,
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
    // L31：无数据直接返回空摘要，避免后续 avg/stdDev 对空数组返回 NaN
    if (count === 0) return EMPTY_SUMMARY;

    for (let i = 0; i < count; i++) {
      const s = getRingAt(this.buffer, i);
      if (!s || s.time < cutoff) continue;

      speeds.push(s.speed);
      lags.push(s.lagDeg);
      confs.push(s.confidence);
      if (s.predError > 0) predErrs.push(s.predError);
      if (s.fps > 0) fpsValues.push(s.fps);
    }

    // L31：所有样本都过期时返回空摘要
    if (speeds.length === 0) return EMPTY_SUMMARY;

    const speedAvg = avg(speeds);
    return {
      speedAvg,
      speedMax: Math.max(...speeds),
      speedMin: Math.min(...speeds),
      speedStd: stdDev(speeds, speedAvg),
      lagAvg: lags.length ? avg(lags) : 0,
      lagMax: lags.length ? Math.max(...lags) : 0,
      lagMin: lags.length ? Math.min(...lags) : 0,
      confAvg: confs.length ? avg(confs) : 0,
      confMax: confs.length ? Math.max(...confs) : 0,
      confMin: confs.length ? Math.min(...confs) : 0,
      predErrorAvg: predErrs.length ? avg(predErrs) : 0,
      predErrorMax: predErrs.length ? Math.max(...predErrs) : 0,
      predErrorMin: predErrs.length ? Math.min(...predErrs) : 0,
      fpsAvg: fpsValues.length ? avg(fpsValues) : 0,
      fpsMax: fpsValues.length ? Math.max(...fpsValues) : 0,
      fpsMin: fpsValues.length ? Math.min(...fpsValues) : 0,
    };
  }
}
