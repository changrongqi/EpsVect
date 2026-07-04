/**
 * 置信度计算模块
 * 根据速度因子和方向稳定性综合评估方向预测的可信度
 */

const THETA_HISTORY_SIZE = 10;

/** 计算圆周方向标准差（弧度），使用 sin/cos 均值法 */
function circularStdDev(angles: number[], count: number): number {
  if (count < 2) return 0;
  let sumSin = 0, sumCos = 0;
  for (let i = 0; i < count; i++) {
    sumSin += Math.sin(angles[i]);
    sumCos += Math.cos(angles[i]);
  }
  const R = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / count;
  return Math.sqrt(-2 * Math.log(Math.max(R, 0.001)));
}

export class ConfidenceCalculator {
  private thetaBuffer: number[] = new Array(THETA_HISTORY_SIZE);
  private thetaWriteIdx = 0;
  private thetaCount = 0;
  private smoothedConfidence = 0;
  private prevConfidence = 0;

  /** 推入方向角历史 */
  pushTheta(theta: number): void {
    this.thetaBuffer[this.thetaWriteIdx] = theta;
    this.thetaWriteIdx = (this.thetaWriteIdx + 1) % THETA_HISTORY_SIZE;
    if (this.thetaCount < THETA_HISTORY_SIZE) this.thetaCount++;
  }

  /** 获取历史数组（按时间顺序，用于标准差计算） */
  private getThetaHistory(): number[] {
    const result: number[] = new Array(this.thetaCount);
    for (let i = 0; i < this.thetaCount; i++) {
      const idx = (this.thetaWriteIdx - this.thetaCount + i + THETA_HISTORY_SIZE) % THETA_HISTORY_SIZE;
      result[i] = this.thetaBuffer[idx];
    }
    return result;
  }

  /** 清空历史（静止时） */
  clearHistory(): void {
    this.thetaWriteIdx = 0;
    this.thetaCount = 0;
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

    const stdAngle = circularStdDev(this.thetaBuffer, this.thetaCount);
    const stdAngleDeg = stdAngle * 180 / Math.PI;
    const stabilityFactor = Math.max(0.3, Math.min(1, 1 - (stdAngleDeg - 3) / 40));

    const rawConfidence = speedFactor * stabilityFactor;
    this.smoothedConfidence = 0.3 * rawConfidence + 0.7 * this.smoothedConfidence;
    this.prevConfidence = this.smoothedConfidence;

    return this.smoothedConfidence;
  }

  reset(): void {
    this.thetaWriteIdx = 0;
    this.thetaCount = 0;
    this.smoothedConfidence = 0;
    this.prevConfidence = 0;
  }
}