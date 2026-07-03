/**
 * 方向检测模块
 * 从平滑坐标中提取移动方向，实现自适应 EMA 平滑和突变检测
 */

export interface DirectionResult {
  /** 原始方向角（弧度） */
  theta: number;
  /** 平滑后的方向角（弧度） */
  smoothedTheta: number;
  /** 方向延迟（度） */
  lagDeg: number;
  /** 检测状态标签 */
  stateLabel: string;
}

export interface MicroWindowEntry {
  x: number;
  y: number;
}

const MICRO_WINDOW = 5;

function angleDiffDeg(a: number, b: number): number {
  let diff = Math.abs(a - b);
  return diff > 180 ? 360 - diff : diff;
}

export class DirectionDetector {
  private microWindow: MicroWindowEntry[] = [];
  private smoothedTheta = 0;
  private prevTheta = 0;
  private prevSpeed = 0;

  /** 推入微位移窗口 */
  pushMicroWindow(x: number, y: number): void {
    this.microWindow.push({ x, y });
    if (this.microWindow.length > MICRO_WINDOW) this.microWindow.shift();
  }

  /** 从窗口做线性回归拟合方向角 */
  private microTheta(): number {
    const len = this.microWindow.length;
    if (len < 3) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (const p of this.microWindow) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumX2 += p.x * p.x;
    }
    const denom = len * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-9) return 0;
    const slope = (len * sumXY - sumX * sumY) / denom;
    return Math.atan(slope);
  }

  /** 执行一步方向检测 */
  detect(speed: number, dx: number, dy: number): DirectionResult {
    let theta: number;
    let stateLabel: string;

    if (speed < 5) {
      theta = 0;
      stateLabel = 'still';
    } else if (speed < 50) {
      theta = this.microTheta();
      stateLabel = 'micro';
    } else {
      theta = Math.atan2(dy, dx);
      if (speed < 200) {
        stateLabel = 'slow';
      } else if (speed < 500) {
        stateLabel = 'medium';
      } else {
        stateLabel = 'fast';
      }
    }

    if (speed >= 5) {
      if (this.prevSpeed < 5 && speed >= 20) {
        this.smoothedTheta = theta;
        this.prevTheta = theta;
      }

      const thetaDeg = theta * 180 / Math.PI;
      const smoothedThetaDeg = this.smoothedTheta * 180 / Math.PI;
      const diff = angleDiffDeg(thetaDeg, smoothedThetaDeg);

      if (diff > 30 && speed > 20) {
        this.smoothedTheta = theta;
        this.prevTheta = theta;
        stateLabel = 'turning';
      } else {
        let alpha: number;
        if (speed < 10) {
          alpha = 0.5;
        } else if (speed < 100) {
          alpha = 0.8;
        } else {
          alpha = 0.9;
        }
        this.smoothedTheta = alpha * theta + (1 - alpha) * this.prevTheta;
        this.prevTheta = this.smoothedTheta;
      }
    }

    this.prevSpeed = speed;

    const thetaDeg = theta * 180 / Math.PI;
    const smoothedThetaDeg = this.smoothedTheta * 180 / Math.PI;
    const lagDeg = speed < 5 ? 0 : angleDiffDeg(thetaDeg, smoothedThetaDeg);

    return { theta, smoothedTheta: this.smoothedTheta, lagDeg, stateLabel };
  }

  reset(): void {
    this.microWindow = [];
    this.smoothedTheta = 0;
    this.prevTheta = 0;
    this.prevSpeed = 0;
  }
}