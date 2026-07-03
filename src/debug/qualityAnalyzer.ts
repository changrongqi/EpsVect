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
    let diff = Math.abs(a - b);
    return diff > 180 ? 360 - diff : diff;
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

  /** 方向精度：匀速段内方向偏差均值（度） */
  private computeDirectionAccuracy(entries: HistoryEntry[]): number {
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
    let prevTheta = 0;
    let prevSmoothed = 0;

    for (const e of entries) {
      const thetaDeg = e.theta * 180 / Math.PI;
      const smoothedDeg = e.smoothedTheta * 180 / Math.PI;
      const rawDiff = QualityAnalyzer.angleDiffDeg(thetaDeg, prevTheta);

      if (rawDiff > 30 && e.speed > 20) {
        let frames = 0;
        const startIdx = entries.indexOf(e);
        for (let j = startIdx; j < Math.min(startIdx + 10, entries.length); j++) {
          frames++;
          const smoothedDiff = QualityAnalyzer.angleDiffDeg(
            entries[j].smoothedTheta * 180 / Math.PI,
            prevSmoothed,
          );
          if (smoothedDiff > rawDiff * 0.7) break;
          if (frames >= 10) break;
        }
        latencies.push(frames);
      }

      prevTheta = thetaDeg;
      prevSmoothed = smoothedDeg;
    }

    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  /** 静止稳定性：静止段滤波坐标标准差（px） */
  private computeStabilityStd(entries: HistoryEntry[]): number {
    const still = entries.filter((e) => e.speed < 5);
    if (still.length < 2) return 0;

    const avgX = still.reduce((s, e) => s + e.smoothX, 0) / still.length;
    const avgY = still.reduce((s, e) => s + e.smoothY, 0) / still.length;
    const variances = still.map((e) => (e.smoothX - avgX) ** 2 + (e.smoothY - avgY) ** 2);
    return Math.sqrt(variances.reduce((a, b) => a + b, 0) / still.length);
  }

  /** 跟手性评分 0~100 */
  private computeFollowScore(entries: HistoryEntry[]): number {
    const dirAcc = this.computeDirectionAccuracy(entries);
    const predErr = this.computePredErrorMean(entries);
    const latency = this.computeResponseLatency(entries);
    const stability = this.computeStabilityStd(entries);

    // 各指标标准化到 0~1（越低越好）
    const dirScore = Math.max(0, 1 - dirAcc / 15);
    const predScore = Math.max(0, 1 - predErr / 30);
    const latScore = Math.max(0, 1 - latency / 5);
    const stabScore = Math.max(0, 1 - stability / 1);

    const total = (dirScore * 0.3 + predScore * 0.3 + latScore * 0.25 + stabScore * 0.15) * 100;
    return Math.round(Math.min(100, total));
  }
}