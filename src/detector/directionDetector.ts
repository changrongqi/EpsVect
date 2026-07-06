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
  private microBuffer: MicroWindowEntry[] = new Array(MICRO_WINDOW);
  private microWriteIdx = 0;
  private microCount = 0;
  private smoothedTheta = 0;
  private prevSpeed = 0;

  /** 推入微位移窗口 */
  pushMicroWindow(x: number, y: number): void {
    this.microBuffer[this.microWriteIdx] = { x, y };
    this.microWriteIdx = (this.microWriteIdx + 1) % MICRO_WINDOW;
    if (this.microCount < MICRO_WINDOW) this.microCount++;
  }

  /** 获取窗口中指定索引的元素（0为最早，count-1为最新） */
  private getMicroEntry(index: number): MicroWindowEntry {
    const idx = (this.microWriteIdx - this.microCount + index + MICRO_WINDOW) % MICRO_WINDOW;
    return this.microBuffer[idx];
  }

  /** 从窗口首尾点计算方向角，使用 Math.atan2 获取完整 [-π, π] 范围 */
  private microTheta(): number {
    const len = this.microCount;
    if (len < 3) return 0;
    const first = this.getMicroEntry(0);
    const last = this.getMicroEntry(len - 1);
    return Math.atan2(last.y - first.y, last.x - first.x);
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
      if (this.prevSpeed < 5) {
        this.smoothedTheta = theta;
      }

      const thetaDeg = theta * 180 / Math.PI;
      const smoothedThetaDeg = this.smoothedTheta * 180 / Math.PI;
      const diff = angleDiffDeg(thetaDeg, smoothedThetaDeg);

      if (diff > 30 && speed > 20) {
        this.smoothedTheta = theta;
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
        this.smoothedTheta = alpha * theta + (1 - alpha) * this.smoothedTheta;
      }
    }

    this.prevSpeed = speed;

    const thetaDeg = theta * 180 / Math.PI;
    const smoothedThetaDeg = this.smoothedTheta * 180 / Math.PI;
    const lagDeg = speed < 5 ? 0 : angleDiffDeg(thetaDeg, smoothedThetaDeg);

    return { theta, smoothedTheta: this.smoothedTheta, lagDeg, stateLabel };
  }

  reset(): void {
    this.microWriteIdx = 0;
    this.microCount = 0;
    this.smoothedTheta = 0;
    this.prevSpeed = 0;
  }
}