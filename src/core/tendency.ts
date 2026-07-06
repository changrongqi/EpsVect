/**
 * 倾向引擎
 *
 * 核心数学模型：
 *   dT/dt = k * alignment * (1 + T)        （当 alignment > 0）
 *   dT/dt = -decay * T                      （当 alignment ≤ 0）
 *
 * 解：T(t) = e^(k*a*t) - 1 + T₀*e^(k*a*t)
 *
 * 高阶导数（无限阶）：
 *   dⁿT/dtⁿ = (k*a)ⁿ * (1 + T₀) * e^(k*a*t)
 *   所有阶导数都随时间和 alignment 指数增长，永不为零
 *
 *   速度 v    = dT/dt     = k*a * (1+T)
 *   加速度 a  = d²T/dt²   = (k*a)² * (1+T)
 *   加加速度 j = d³T/dt³   = (k*a)³ * (1+T)
 *   加加加速度 s = d⁴T/dt⁴ = (k*a)⁴ * (1+T)
 *   ... 无限延续
 */

export class TendencyEngine {
  private _tendency = 0;
  private _direction = 0;
  private _alignment = 0;

  /** 指数增长系数 */
  private k = 2.0;
  /** 衰减系数 */
  private decay = 2.5;

  /** 方向历史窗口：最近 N 帧的预测方向，用于计算圆均值 */
  private readonly thetaWindow: number[];
  private thetaWriteIdx = 0;
  private thetaCount = 0;
  /** 窗口大小（帧数，约 250ms @ 60fps） */
  private readonly windowSize = 15;

  constructor() {
    this.thetaWindow = new Array(this.windowSize);
  }

  get tendency(): number {
    return this._tendency;
  }
  get direction(): number {
    return this._direction;
  }
  get alignment(): number {
    return this._alignment;
  }

  /**
   * 更新倾向值
   * @param dt 时间增量（秒）
   * @param predictedTheta 当前帧算法预测的方向角（弧度）
   * @param targetAngle 目标入口的角度（弧度）
   * @returns 当前倾向值 [0, 1]
   */
  update(dt: number, predictedTheta: number, targetAngle: number): number {
    // 推入方向历史窗口
    this.thetaWindow[this.thetaWriteIdx] = predictedTheta;
    this.thetaWriteIdx = (this.thetaWriteIdx + 1) % this.windowSize;
    if (this.thetaCount < this.windowSize) this.thetaCount++;

    // 计算圆均值方向
    const meanTheta = this.circularMean();

    const rawAlignment = Math.cos(meanTheta - targetAngle);
    this._alignment = Math.max(0, rawAlignment);

    if (this._alignment > 0.02) {
      this._tendency += this.k * this._alignment * (1 + this._tendency) * dt;
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
    this.thetaWriteIdx = 0;
    this.thetaCount = 0;
  }

  /** 计算方向历史窗口的圆均值 */
  private circularMean(): number {
    if (this.thetaCount === 0) return 0;
    let sumSin = 0;
    let sumCos = 0;
    for (let i = 0; i < this.thetaCount; i++) {
      const theta = this.thetaWindow[i];
      sumSin += Math.sin(theta);
      sumCos += Math.cos(theta);
    }
    return Math.atan2(sumSin, sumCos);
  }
}