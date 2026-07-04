/**
 * 置信度计算模块
 * 根据速度因子和方向稳定性综合评估方向预测的可信度
 */

const THETA_HISTORY_SIZE = 10;

/** 计算圆周方向标准差（弧度），使用 sin/cos 均值法 */
function circularStdDev(angles: number[]): number {
  if (angles.length < 2) return 0;
  let sumSin = 0, sumCos = 0;
  for (const a of angles) {
    sumSin += Math.sin(a);
    sumCos += Math.cos(a);
  }
  const R = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / angles.length;
  return Math.sqrt(-2 * Math.log(Math.max(R, 0.001)));
}

export class ConfidenceCalculator {
  private thetaHistory: number[] = [];
  private smoothedConfidence = 0;
  private prevConfidence = 0;

  /** 推入方向角历史 */
  pushTheta(theta: number): void {
    this.thetaHistory.push(theta);
    if (this.thetaHistory.length > THETA_HISTORY_SIZE) this.thetaHistory.shift();
  }

  /** 清空历史（静止时） */
  clearHistory(): void {
    this.thetaHistory = [];
  }

  /** 计算置信度 */
  compute(speed: number): number {
    if (speed < 5) {
      this.smoothedConfidence = 0;
      this.prevConfidence = 0;
      return 0;
    }

    const speedFactor =
      Math.min(1, Math.max(0, (speed - 5) / 100)) * 0.6 +
      (speed > 100 ? Math.min(0.4, (speed - 100) / 400) : 0);

    const stdAngle = circularStdDev(this.thetaHistory);
    const stdAngleDeg = stdAngle * 180 / Math.PI;
    const stabilityFactor = Math.max(0.3, Math.min(1, 1 - (stdAngleDeg - 3) / 40));

    const rawConfidence = speedFactor * stabilityFactor;
    this.smoothedConfidence = 0.3 * rawConfidence + 0.7 * this.prevConfidence;
    this.prevConfidence = this.smoothedConfidence;

    return this.smoothedConfidence;
  }

  reset(): void {
    this.thetaHistory = [];
    this.smoothedConfidence = 0;
    this.prevConfidence = 0;
  }
}