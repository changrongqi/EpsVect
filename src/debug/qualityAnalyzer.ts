/**
 * 质量分析器
 * 基于历史记录数据计算算法质量 KPI
 */

import { HistoryEntry } from './historyRecorder';

export interface QualityKPI {
  directionAccuracy: number;
  predErrorMean: number;
  responseLatency: number;
  stabilityStd: number;
  followScore: number;
}

export class QualityAnalyzer {
  /** 计算两个角度差（度），处理环绕 */
  private static angleDiffDeg(a: number, b: number): number {
    let diff = a - b;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return Math.abs(diff);
  }

  analyze(entries: HistoryEntry[]): QualityKPI {
    if (entries.length < 10) {
      return { directionAccuracy: 0, predErrorMean: 0, responseLatency: 0, stabilityStd: 0, followScore: 0 };
    }

    const directionAccuracy = this.computeDirectionAccuracy(entries);
    const predErrorMean = this.computePredErrorMean(entries);
    const responseLatency = this.computeResponseLatency(entries);
    const stabilityStd = this.computeStabilityStd(entries);
    const followScore = this.computeFollowScore(entries);

    return { directionAccuracy, predErrorMean, responseLatency, stabilityStd, followScore };
  }

  /** 方向精度：预测方向与实际移动方向的偏差均值（度） */
  private computeDirectionAccuracy(entries: HistoryEntry[]): number {
    const diffs: number[] = [];
    for (let i = 0; i < entries.length - 1; i++) {
      const e = entries[i];
      if (e.speed < 5) continue;

      const predTheta = Math.atan2(e.vy, e.vx);
      const predDeg = predTheta * 180 / Math.PI;

      const next = entries[i + 1];
      const actualDx = next.smoothX - e.smoothX;
      const actualDy = next.smoothY - e.smoothY;
      const actualTheta = Math.atan2(actualDy, actualDx);
      const actualDeg = actualTheta * 180 / Math.PI;

      diffs.push(QualityAnalyzer.angleDiffDeg(predDeg, actualDeg));
    }
    if (diffs.length === 0) return 0;
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }

  /** 平滑延迟：原始方向与平滑方向的偏差均值（度） */
  private computeSmoothDelay(entries: HistoryEntry[]): number {
    const diffs: number[] = [];
    for (const e of entries) {
      if (e.speed < 5) continue;
      const thetaDeg = e.theta * 180 / Math.PI;
      const smoothedDeg = e.smoothedTheta * 180 / Math.PI;
      diffs.push(QualityAnalyzer.angleDiffDeg(thetaDeg, smoothedDeg));
    }
    if (diffs.length === 0) return 0;
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }

  /** 预测误差均值（px） */
  private computePredErrorMean(entries: HistoryEntry[]): number {
    const errors = entries.filter((e) => e.speed >= 5).map((e) => e.predError);
    if (errors.length === 0) return 0;
    return errors.reduce((a, b) => a + b, 0) / errors.length;
  }

  /** 响应延迟：方向突变后 smoothedTheta 跟上所需的平均帧数 */
  private computeResponseLatency(entries: HistoryEntry[]): number {
    const latencies: number[] = [];
    let prevTheta = null;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const thetaDeg = e.theta * 180 / Math.PI;

      if (prevTheta !== null && e.speed > 20) {
        const rawDiff = QualityAnalyzer.angleDiffDeg(thetaDeg, prevTheta);

        if (rawDiff > 30) {
          let frames = 0;
          const targetTheta = thetaDeg;
          for (let j = i; j < Math.min(i + 10, entries.length); j++) {
            frames++;
            const smoothedDeg = entries[j].smoothedTheta * 180 / Math.PI;
            const smoothedDiff = QualityAnalyzer.angleDiffDeg(smoothedDeg, targetTheta);
            if (smoothedDiff < rawDiff * 0.3) break;
            if (frames >= 10) break;
          }
          latencies.push(frames);
        }
      }

      if (e.speed > 5) {
        prevTheta = thetaDeg;
      }
    }

    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  /** 静止稳定性：静止段滤波坐标标准差（px） */
  private computeStabilityStd(entries: HistoryEntry[]): number {
    const stillSegments: HistoryEntry[][] = [];
    let currentSegment: HistoryEntry[] = [];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.speed < 5) {
        currentSegment.push(e);
      } else {
        if (currentSegment.length >= 30) {
          stillSegments.push(currentSegment);
        }
        currentSegment = [];
      }
    }
    if (currentSegment.length >= 30) {
      stillSegments.push(currentSegment);
    }

    if (stillSegments.length === 0) return 0;

    const totalVariance = stillSegments.reduce((sum, seg) => {
      const avgX = seg.reduce((s, e) => s + e.smoothX, 0) / seg.length;
      const avgY = seg.reduce((s, e) => s + e.smoothY, 0) / seg.length;
      const variance = seg.reduce((v, e) => v + (e.smoothX - avgX) ** 2 + (e.smoothY - avgY) ** 2, 0);
      return sum + variance;
    }, 0);

    const totalCount = stillSegments.reduce((sum, seg) => sum + seg.length, 0);
    return Math.sqrt(totalVariance / totalCount);
  }

  /** 跟手性评分 0~100 */
  private computeFollowScore(entries: HistoryEntry[]): number {
    const dirAcc = this.computeDirectionAccuracy(entries);
    const predErr = this.computePredErrorMean(entries);
    const latency = this.computeResponseLatency(entries);
    const stability = this.computeStabilityStd(entries);

    const dirScore = Math.min(1, Math.max(0, 1 - dirAcc / 15));
    const predScore = Math.min(1, Math.max(0, 1 - predErr / 30));
    const latScore = Math.min(1, Math.max(0, 1 - latency / 5));
    const stabScore = Math.min(1, Math.max(0, 1 - stability));

    const total = (dirScore * 0.3 + predScore * 0.3 + latScore * 0.25 + stabScore * 0.15) * 100;
    return Math.round(Math.min(100, Math.max(0, total)));
  }
}