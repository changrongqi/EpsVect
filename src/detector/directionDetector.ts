import { createRingBuffer, pushRing, getRingAt, getRingCount, clearRing } from '../util/ringBuffer';
import { emaAngle, angleDiffDeg, radToDeg } from '../math/angleUtils';

export interface DirectionResult {
  theta: number;
  smoothedTheta: number;
  lagDeg: number;
  stateLabel: string;
}

export interface MicroWindowEntry {
  x: number;
  y: number;
}

const MICRO_WINDOW = 5;

export class DirectionDetector {
  private microBuffer = createRingBuffer<MicroWindowEntry>(MICRO_WINDOW);
  // 初始为 NaN，表示尚未获得有效方向。避免初始值 0（右方向）造成前几帧方向偏置
  private smoothedTheta: number = NaN;
  private prevSpeed = 0;

  pushMicroWindow(x: number, y: number): void {
    pushRing(this.microBuffer, { x, y });
  }

  private getMicroEntry(index: number): MicroWindowEntry {
    return getRingAt(this.microBuffer, index);
  }

  private microTheta(): number {
    const len = getRingCount(this.microBuffer);
    // 缓冲不足时返回 NaN，让上游跳过方向更新，避免启动期偏向右侧（theta=0）
    if (len < 3) return NaN;
    const first = this.getMicroEntry(0);
    const last = this.getMicroEntry(len - 1);
    return Math.atan2(last.y - first.y, last.x - first.x);
  }

  detect(speed: number, dx: number, dy: number): DirectionResult {
    let theta: number;
    let stateLabel: string;

    if (speed < 5) {
      // L5：静止时不返回 theta=0（右方向偏置），改为保持上次有效方向。
      // smoothedTheta 可能为 NaN（首次），由上游 Number.isNaN 短路处理。
      theta = Number.isNaN(this.smoothedTheta) ? NaN : this.smoothedTheta;
      stateLabel = 'still';
    } else if (speed < 50) {
      const microResult = this.microTheta();
      if (Number.isNaN(microResult)) {
        // 缓冲不足，跳过本次方向更新。若 smoothedTheta 也未初始化，用 atan2 兜底
        theta = Number.isNaN(this.smoothedTheta) ? Math.atan2(dy, dx) : this.smoothedTheta;
        stateLabel = 'still';
      } else {
        theta = microResult;
        stateLabel = 'micro';
      }
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
      // smoothedTheta 为 NaN（首次有效方向）或 prevSpeed<5（从静止恢复）时直接赋值
      if (Number.isNaN(this.smoothedTheta) || this.prevSpeed < 5) {
        this.smoothedTheta = theta;
      }

      const thetaDeg = radToDeg(theta);
      const smoothedThetaDeg = radToDeg(this.smoothedTheta);
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
        this.smoothedTheta = emaAngle(theta, this.smoothedTheta, alpha);
      }
    }

    this.prevSpeed = speed;

    const thetaDeg = radToDeg(theta);
    const smoothedThetaDeg = radToDeg(this.smoothedTheta);
    const lagDeg = speed < 5 ? 0 : angleDiffDeg(thetaDeg, smoothedThetaDeg);

    return { theta, smoothedTheta: this.smoothedTheta, lagDeg, stateLabel };
  }

  reset(): void {
    clearRing(this.microBuffer);
    this.smoothedTheta = NaN;
    this.prevSpeed = 0;
  }
}
