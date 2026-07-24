import { createRingBuffer, pushRing, getRingCount, clearRing, toArray } from '../util/ringBuffer';
import { circularStdDev, radToDeg } from '../math/angleUtils';

const THETA_HISTORY_SIZE = 10;

export class ConfidenceCalculator {
  private thetaBuffer = createRingBuffer<number>(THETA_HISTORY_SIZE);
  private smoothedConfidence = 0;
  // L3：删除 prevConfidence（写入但从不读取，死字段）

  pushTheta(theta: number): void {
    pushRing(this.thetaBuffer, theta);
  }

  clearHistory(): void {
    clearRing(this.thetaBuffer);
  }

  compute(speed: number): number {
    if (speed < 5) {
      this.smoothedConfidence = 0;
      return 0;
    }

    const speedFactor =
      Math.min(1, Math.max(0, (speed - 5) / 100)) * 0.6 +
      (speed > 100 ? Math.min(0.4, (speed - 100) / 400) : 0);

    const angles = toArray(this.thetaBuffer);
    const count = getRingCount(this.thetaBuffer);
    const stdAngle = circularStdDev(angles, count);
    const stdAngleDeg = radToDeg(stdAngle);
    const stabilityFactor = Math.max(0.3, Math.min(1, 1 - (stdAngleDeg - 3) / 40));

    const rawConfidence = speedFactor * stabilityFactor;
    this.smoothedConfidence = 0.3 * rawConfidence + 0.7 * this.smoothedConfidence;

    return this.smoothedConfidence;
  }

  reset(): void {
    clearRing(this.thetaBuffer);
    this.smoothedConfidence = 0;
  }
}
