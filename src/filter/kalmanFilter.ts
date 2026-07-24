import {
  identity4,
  scaleMatrix,
  addMat4,
  subMat4,
  mulMat4,
  transpose4,
  mulMatVec4,
  mulMatVec2x4,
  mulMat4x2Transpose,
  mulMat2x4x4x2,
  addMat2x2,
  inv2x2,
  mulMat4x2x2x2,
  mulMat4x2x2x4,
  diag4,
  diag2,
} from '../math/matrix4';

export interface KalmanState {
  x: [number, number, number, number];
  P: number[][];
}

export interface KalmanConfig {
  dt: number;
  Q: number;
  R: number;
  initialP: number;
}

const DEFAULT_CONFIG: KalmanConfig = {
  dt: 16,
  Q: 200,
  R: 50,
  initialP: 100,
};

export class KalmanFilter {
  private A: number[][];
  private H: number[][];
  private Q: number[][];
  private R: number[][];
  private I: number[][];
  private x: [number, number, number, number];
  private P: number[][];
  private predictedX: [number, number, number, number] | null = null;
  private dt: number;
  private initialized: boolean;
  // 保存 initialP 用于首帧/reset 时恢复协方差
  private readonly initialP: number;

  constructor(config: Partial<KalmanConfig> = {}) {
    const { dt, Q, R, initialP } = { ...DEFAULT_CONFIG, ...config };
    this.dt = dt / 1000;
    this.initialP = initialP;

    this.A = this.buildTransitionMatrix(this.dt);
    this.H = this.buildObservationMatrix();
    this.Q = diag4(Q);
    this.R = diag2(R);
    this.I = identity4();

    this.x = [0, 0, 0, 0];
    this.P = scaleMatrix(identity4(), initialP);
    this.initialized = false;
  }

  private buildTransitionMatrix(dtSec: number): number[][] {
    return [
      [1, 0, dtSec, 0],
      [0, 1, 0, dtSec],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  }

  private buildObservationMatrix(): number[][] {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ];
  }

  project(): void {
    this.x = mulMatVec4(this.A, this.x);
    const AP = mulMat4(this.A, this.P);
    const At = transpose4(this.A);
    const APA = mulMat4(AP, At);
    this.P = addMat4(APA, this.Q);
    this.predictedX = [...this.x];
  }

  update(measX: number, measY: number): void {
    const z = [measX, measY];

    const Hx = mulMatVec2x4(this.H, this.x);
    const y = [z[0] - Hx[0], z[1] - Hx[1]];

    const PHt = mulMat4x2Transpose(this.P, this.H);
    const S = addMat2x2(mulMat2x4x4x2(this.H, this.P, this.H), this.R);

    const SInv = inv2x2(S);
    const K = mulMat4x2x2x2(PHt, SInv);

    const Ky = [
      K[0][0] * y[0] + K[0][1] * y[1],
      K[1][0] * y[0] + K[1][1] * y[1],
      K[2][0] * y[0] + K[2][1] * y[1],
      K[3][0] * y[0] + K[3][1] * y[1],
    ];
    this.x = [this.x[0] + Ky[0], this.x[1] + Ky[1], this.x[2] + Ky[2], this.x[3] + Ky[3]];

    const KH = mulMat4x2x2x4(K, this.H);
    const IKH = subMat4(this.I, KH);
    this.P = mulMat4(IKH, this.P);
  }

  step(measX: number, measY: number): void {
    if (!this.initialized) {
      // 首帧：直接用测量值初始化状态，跳过 project（避免 P 被提前推进一帧）
      this.x = [measX, measY, 0, 0];
      this.predictedX = [measX, measY, 0, 0];
      this.P = scaleMatrix(identity4(), this.initialP);
      this.initialized = true;
    } else {
      this.project();
      this.update(measX, measY);
    }
  }

  getState(): KalmanState {
    return {
      x: [...this.x] as [number, number, number, number],
      P: this.P.map((row) => [...row]),
    };
  }

  getPredictedPosition(): { x: number; y: number } {
    if (this.predictedX) {
      return { x: this.predictedX[0], y: this.predictedX[1] };
    }
    return { x: this.x[0], y: this.x[1] };
  }

  getVelocity(): { vx: number; vy: number } {
    return { vx: this.x[2], vy: this.x[3] };
  }

  setDt(dtMs: number): void {
    this.dt = dtMs / 1000;
    this.A = this.buildTransitionMatrix(this.dt);
  }

  setQ(value: number): void {
    this.Q = diag4(value);
  }

  setR(value: number): void {
    this.R = diag2(value);
  }

  reset(): void {
    this.x = [0, 0, 0, 0];
    this.P = scaleMatrix(identity4(), this.initialP);
    this.predictedX = null;
    this.initialized = false;
    // 还原 dt 与 A 矩阵为默认值，防止运行期 setDt 修改后 reset 未恢复
    this.dt = DEFAULT_CONFIG.dt / 1000;
    this.A = this.buildTransitionMatrix(this.dt);
  }
}
