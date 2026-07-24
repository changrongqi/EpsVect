import { HistoryEntry } from './historyRecorder';
import { radToDeg } from '../math/angleUtils';

export interface QualityKPI {
  directionAccuracy: number;
  predErrorMean: number;
  responseLatency: number;
  stabilityStd: number;
  followScore: number;
}

export class QualityAnalyzer {
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
    const followScore = this.computeFollowScore(directionAccuracy, predErrorMean, responseLatency, stabilityStd);

    return { directionAccuracy, predErrorMean, responseLatency, stabilityStd, followScore };
  }

  private computeDirectionAccuracy(entries: HistoryEntry[]): number {
    const diffs: number[] = [];
    for (let i = 0; i < entries.length - 1; i++) {
      const e = entries[i];
      if (e.speed < 5) continue;

      const predDeg = radToDeg(Math.atan2(e.vy, e.vx));
      const next = entries[i + 1];
      const actualDx = next.smoothX - e.smoothX;
      const actualDy = next.smoothY - e.smoothY;
      const actualDeg = radToDeg(Math.atan2(actualDy, actualDx));

      diffs.push(QualityAnalyzer.angleDiffDeg(predDeg, actualDeg));
    }
    if (diffs.length === 0) return 0;
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }

  private computePredErrorMean(entries: HistoryEntry[]): number {
    const errors = entries.filter((e) => e.speed >= 5).map((e) => e.predError);
    if (errors.length === 0) return 0;
    return errors.reduce((a, b) => a + b, 0) / errors.length;
  }

  private computeResponseLatency(entries: HistoryEntry[]): number {
    const latencies: number[] = [];
    let prevTheta: number | null = null;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const thetaDeg = radToDeg(e.theta);

      if (prevTheta !== null && e.speed > 20) {
        const rawDiff = QualityAnalyzer.angleDiffDeg(thetaDeg, prevTheta);

        if (rawDiff > 30) {
          let frames = 0;
          const targetTheta = thetaDeg;
          for (let j = i; j < Math.min(i + 10, entries.length); j++) {
            frames++;
            const smoothedDeg = radToDeg(entries[j].smoothedTheta);
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

  private computeFollowScore(
    directionAccuracy: number,
    predErrorMean: number,
    responseLatency: number,
    stabilityStd: number,
  ): number {
    const dirScore = Math.min(1, Math.max(0, 1 - directionAccuracy / 15));
    const predScore = Math.min(1, Math.max(0, 1 - predErrorMean / 30));
    const latScore = Math.min(1, Math.max(0, 1 - responseLatency / 5));
    const stabScore = Math.min(1, Math.max(0, 1 - stabilityStd / 2));

    const total = (dirScore * 0.3 + predScore * 0.3 + latScore * 0.25 + stabScore * 0.15) * 100;
    return Math.round(Math.min(100, Math.max(0, total)));
  }
}
