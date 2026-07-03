/**
 * 统计采集器
 * 使用环形缓冲区维护最近 N 毫秒的采样数据，提供聚合统计
 */

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
  speedStd: number;
  lagAvg: number;
  lagMax: number;
  confAvg: number;
  predErrorAvg: number;
  fpsMin: number;
}

export class StatsCollector {
  private readonly windowMs: number;
  private readonly buffer: StatsSample[];
  private writeIdx = 0;
  private count = 0;

  /** 缓存上一帧的预测坐标，用于计算预测误差 */
  private prevPredX = 0;
  private prevPredY = 0;
  private hasPrevPred = false;

  constructor(windowMs: number = 1000, capacity: number = 600) {
    this.windowMs = windowMs;
    this.buffer = new Array<StatsSample>(capacity);
  }

  /** 记录一帧数据，返回预测误差 */
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
    let predError = 0;
    if (this.hasPrevPred && speed >= 5) {
      const dx = this.prevPredX - smoothX;
      const dy = this.prevPredY - smoothY;
      predError = Math.sqrt(dx * dx + dy * dy);
    }

    this.prevPredX = predX;
    this.prevPredY = predY;
    this.hasPrevPred = true;

    const sample: StatsSample = {
      time: performance.now(),
      speed,
      lagDeg,
      confidence,
      fps,
      predError,
    };

    this.buffer[this.writeIdx] = sample;
    this.writeIdx = (this.writeIdx + 1) % this.buffer.length;
    if (this.count < this.buffer.length) this.count++;

    return predError;
  }

  /** 计算窗口内的聚合统计 */
  summarize(): StatsSummary {
    const now = performance.now();
    const cutoff = now - this.windowMs;
    const speeds: number[] = [];
    const lags: number[] = [];
    const confs: number[] = [];
    const predErrs: number[] = [];
    let fpsMin = Infinity;

    for (let i = 0; i < this.count; i++) {
      const idx = (this.writeIdx - 1 - i + this.buffer.length) % this.buffer.length;
      const s = this.buffer[idx];
      if (s.time < cutoff) break;

      speeds.push(s.speed);
      lags.push(s.lagDeg);
      confs.push(s.confidence);
      if (s.predError > 0) predErrs.push(s.predError);
      if (s.fps < fpsMin) fpsMin = s.fps;
    }

    const avg = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length);
    const max = (arr: number[]) => (arr.length === 0 ? 0 : Math.max(...arr));
    const std = (arr: number[], mean: number) => {
      if (arr.length < 2) return 0;
      const sqDiffs = arr.map((v) => (v - mean) * (v - mean));
      return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / arr.length);
    };

    const speedAvg = avg(speeds);
    return {
      speedAvg,
      speedMax: max(speeds),
      speedStd: std(speeds, speedAvg),
      lagAvg: avg(lags),
      lagMax: max(lags),
      confAvg: avg(confs),
      predErrorAvg: avg(predErrs),
      fpsMin: fpsMin === Infinity ? 0 : fpsMin,
    };
  }
}