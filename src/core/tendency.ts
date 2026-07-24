import { createRingBuffer, pushRing, getRingCount, clearRing, toArray } from '../util/ringBuffer';
import { circularMean } from '../math/angleUtils';

const WINDOW_SIZE = 15;

export class TendencyEngine {
  private _tendency = 0;
  private _direction = 0;
  private _alignment = 0;

  private k = 2.0;
  private decay = 2.5;

  private thetaWindow = createRingBuffer<number>(WINDOW_SIZE);

  get tendency(): number {
    return this._tendency;
  }
  get direction(): number {
    return this._direction;
  }
  get alignment(): number {
    return this._alignment;
  }

  update(dt: number, predictedTheta: number, targetAngle: number): number {
    pushRing(this.thetaWindow, predictedTheta);

    const count = getRingCount(this.thetaWindow);
    const angles = toArray(this.thetaWindow);
    const meanTheta = circularMean(angles, count);

    // 角度约定统一：
    // - predictedTheta / meanTheta：从正东起算、atan2 风格（鼠标速度方向）
    // - targetAngle：从正北起算、罗盘方位（与 entryConfig.theta 一致）
    // 比较前需统一为同一约定。将 targetAngle 转为从正东起算：减去 π/2。
    const targetAngleEast = targetAngle - Math.PI / 2;
    const rawAlignment = Math.cos(meanTheta - targetAngleEast);
    this._alignment = Math.max(0, rawAlignment);

    if (this._alignment > 0.02) {
      this._tendency += this.k * this._alignment * (1 + this._tendency) * dt;
      // _direction 保持从正北起算的原始约定（供 starry 等下游使用）
      this._direction = targetAngle;
    } else {
      this._tendency -= this.decay * this._tendency * dt;
    }

    this._tendency = Math.max(0, Math.min(1, this._tendency));
    return this._tendency;
  }

  reset(): void {
    this._tendency = 0;
    this._alignment = 0;
    this._direction = 0;
    clearRing(this.thetaWindow);
  }
}
