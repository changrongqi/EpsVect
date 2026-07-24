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
  private smoothedTheta = 0;
  private prevSpeed = 0;

  pushMicroWindow(x: number, y: number): void {
    pushRing(this.microBuffer, { x, y });
  }

  private getMicroEntry(index: number): MicroWindowEntry {
    return getRingAt(this.microBuffer, index);
  }

  private microTheta(): number {
    const len = getRingCount(this.microBuffer);
    if (len < 3) return 0;
    const first = this.getMicroEntry(0);
    const last = this.getMicroEntry(len - 1);
    return Math.atan2(last.y - first.y, last.x - first.x);
  }

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
    this.smoothedTheta = 0;
    this.prevSpeed = 0;
  }
}
