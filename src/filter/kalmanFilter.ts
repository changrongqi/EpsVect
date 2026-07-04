/**
 * 4 维 Kalman Filter 预测引擎
 * 状态向量 [x, y, vx, vy]，匀速运动模型
 * 从 One Euro Filter 降噪后的坐标推断速度，预测下一帧位置
 */

export interface KalmanState {
  /** 预测位置 + 速度 [x, y, vx, vy] */
  x: [number, number, number, number];
  /** 协方差矩阵 4x4 */
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
  initialP: 100, // 初始协方差足够大，速度估计能快速收敛
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

  constructor(config: Partial<KalmanConfig> = {}) {
    const { dt, Q, R, initialP } = { ...DEFAULT_CONFIG, ...config };
    this.dt = dt / 1000; // 转换为秒

    // 状态转移矩阵 A（匀速运动模型）
    this.A = [
      [1, 0, this.dt, 0],
      [0, 1, 0, this.dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    // 观测矩阵 H（只能观测位置）
    this.H = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ];

    // 过程噪声 Q（对角矩阵）
    const q = Q;
    this.Q = [
      [q, 0, 0, 0],
      [0, q, 0, 0],
      [0, 0, q, 0],
      [0, 0, 0, q],
    ];

    // 测量噪声 R（2x2 对角矩阵）
    this.R = [
      [R, 0],
      [0, R],
    ];

    // 单位矩阵
    this.I = identity4();

    // 初始状态
    this.x = [0, 0, 0, 0];
    this.P = scaleMatrix(identity4(), initialP);
    this.initialized = false;
  }

  /** 预测步：根据上一帧状态外推当前帧 */
  project(): void {
    this.x = mulMatVec4(this.A, this.x);
    const AP = mulMat4(this.A, this.P);
    const At = transpose4(this.A);
    const APA = mulMat4(AP, At);
    this.P = addMat4(APA, this.Q);
    this.predictedX = [...this.x];
  }

  /** 修正步：用新测量值修正预测 */
  update(measX: number, measY: number): void {
    const z = [measX, measY];

    // 创新 y = z - H*x
    const Hx = mulMatVec2x4(this.H, this.x);
    const y = [z[0] - Hx[0], z[1] - Hx[1]];

    // 创新协方差 S = H*P*H^T + R
    const PHt = mulMat4x2Transpose(this.P, this.H);
    const S = addMat2x2(mulMat2x4x4x2(this.H, this.P, this.H), this.R);

    // 卡尔曼增益 K = P*H^T * S^-1
    const SInv = inv2x2(S);
    const K = mulMat4x2x2x2(PHt, SInv);

    // 状态更新 x = x + K*y
    const Ky = [K[0][0] * y[0] + K[0][1] * y[1],
                K[1][0] * y[0] + K[1][1] * y[1],
                K[2][0] * y[0] + K[2][1] * y[1],
                K[3][0] * y[0] + K[3][1] * y[1]];
    this.x = [this.x[0] + Ky[0], this.x[1] + Ky[1], this.x[2] + Ky[2], this.x[3] + Ky[3]];

    // 协方差更新 P = (I - K*H) * P
    const KH = mulMat4x2x2x4(K, this.H);
    const IKH = subMat4(this.I, KH);
    this.P = mulMat4(IKH, this.P);
  }

  /** 执行一步滤波：先 project 再 update */
  step(measX: number, measY: number): void {
    this.project();

    if (!this.initialized) {
      // 第一帧：直接设置位置，速度归零
      this.x = [measX, measY, 0, 0];
      this.initialized = true;
    } else {
      this.update(measX, measY);
    }
  }

  /** 获取当前状态 */
  getState(): KalmanState {
    return {
      x: [...this.x] as [number, number, number, number],
      P: this.P.map(row => [...row]),
    };
  }

  /** 获取预测位置（project后的状态，未被update修正） */
  getPredictedPosition(): { x: number; y: number } {
    if (this.predictedX) {
      const pred = mulMatVec4(this.A, this.predictedX);
      return { x: pred[0], y: pred[1] };
    }
    return { x: this.x[0], y: this.x[1] };
  }

  /** 获取速度向量 */
  getVelocity(): { vx: number; vy: number } {
    return { vx: this.x[2], vy: this.x[3] };
  }

  /** 更新 dt（采样间隔变化时） */
  setDt(dtMs: number): void {
    this.dt = dtMs / 1000;
    this.A[0][2] = this.dt;
    this.A[1][3] = this.dt;
  }

  /** 更新过程噪声 Q（不重建实例，保留状态估计） */
  setQ(value: number): void {
    const q = value;
    this.Q = [
      [q, 0, 0, 0],
      [0, q, 0, 0],
      [0, 0, q, 0],
      [0, 0, 0, q],
    ];
  }

  /** 更新测量噪声 R（不重建实例，保留状态估计） */
  setR(value: number): void {
    this.R = [
      [value, 0],
      [0, value],
    ];
  }

  reset(): void {
    this.x = [0, 0, 0, 0];
    this.P = scaleMatrix(identity4(), DEFAULT_CONFIG.initialP);
    this.initialized = false;
  }
}

// ===== 4x4 矩阵运算（内联，避免额外依赖） =====

function identity4(): number[][] {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function transpose4(m: number[][]): number[][] {
  const r: number[][] = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      r[i][j] = m[j][i];
    }
  }
  return r;
}

function scaleMatrix(m: number[][], s: number): number[][] {
  return m.map(row => row.map(v => v * s));
}

function addMat4(a: number[][], b: number[][]): number[][] {
  const r: number[][] = [];
  for (let i = 0; i < 4; i++) {
    r[i] = [];
    for (let j = 0; j < 4; j++) {
      r[i][j] = a[i][j] + b[i][j];
    }
  }
  return r;
}

function subMat4(a: number[][], b: number[][]): number[][] {
  const r: number[][] = [];
  for (let i = 0; i < 4; i++) {
    r[i] = [];
    for (let j = 0; j < 4; j++) {
      r[i][j] = a[i][j] - b[i][j];
    }
  }
  return r;
}

function mulMat4(a: number[][], b: number[][], extra?: number[][]): number[][] {
  const r: number[][] = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        r[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  if (extra) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        r[i][j] += extra[i][j];
      }
    }
  }
  return r;
}

function mulMatVec4(A: number[][], v: [number, number, number, number]): [number, number, number, number] {
  return [
    A[0][0]*v[0] + A[0][1]*v[1] + A[0][2]*v[2] + A[0][3]*v[3],
    A[1][0]*v[0] + A[1][1]*v[1] + A[1][2]*v[2] + A[1][3]*v[3],
    A[2][0]*v[0] + A[2][1]*v[1] + A[2][2]*v[2] + A[2][3]*v[3],
    A[3][0]*v[0] + A[3][1]*v[1] + A[3][2]*v[2] + A[3][3]*v[3],
  ];
}

function mulMatVec2x4(H: number[][], v: [number, number, number, number]): [number, number] {
  return [
    H[0][0]*v[0] + H[0][1]*v[1] + H[0][2]*v[2] + H[0][3]*v[3],
    H[1][0]*v[0] + H[1][1]*v[1] + H[1][2]*v[2] + H[1][3]*v[3],
  ];
}

/** P * H^T → 4x2 */
function mulMat4x2Transpose(P: number[][], H: number[][]): number[][] {
  const r: number[][] = [[0,0],[0,0],[0,0],[0,0]];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 4; k++) {
        r[i][j] += P[i][k] * H[j][k];
      }
    }
  }
  return r;
}

/** H * P * H^T → 2x2 */
function mulMat2x4x4x2(H: number[][], P: number[][], Ht: number[][]): number[][] {
  const PHt = mulMat4x2Transpose(P, Ht);
  const r: number[][] = [[0,0],[0,0]];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 4; k++) {
        r[i][j] += H[i][k] * PHt[k][j];
      }
    }
  }
  return r;
}

function addMat2x2(a: number[][], b: number[][]): number[][] {
  return [
    [a[0][0] + b[0][0], a[0][1] + b[0][1]],
    [a[1][0] + b[1][0], a[1][1] + b[1][1]],
  ];
}

/** 2x2 矩阵求逆 */
function inv2x2(m: number[][]): number[][] {
  const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  if (Math.abs(det) < 1e-12) return [[1, 0], [0, 1]];
  const invDet = 1 / det;
  return [
    [m[1][1] * invDet, -m[0][1] * invDet],
    [-m[1][0] * invDet, m[0][0] * invDet],
  ];
}

/** K(4x2) * SInv(2x2) → 4x2 */
function mulMat4x2x2x2(K: number[][], SInv: number[][]): number[][] {
  return [
    [K[0][0]*SInv[0][0] + K[0][1]*SInv[1][0], K[0][0]*SInv[0][1] + K[0][1]*SInv[1][1]],
    [K[1][0]*SInv[0][0] + K[1][1]*SInv[1][0], K[1][0]*SInv[0][1] + K[1][1]*SInv[1][1]],
    [K[2][0]*SInv[0][0] + K[2][1]*SInv[1][0], K[2][0]*SInv[0][1] + K[2][1]*SInv[1][1]],
    [K[3][0]*SInv[0][0] + K[3][1]*SInv[1][0], K[3][0]*SInv[0][1] + K[3][1]*SInv[1][1]],
  ];
}

/** K(4x2) * H(2x4) → 4x4 */
function mulMat4x2x2x4(K: number[][], H: number[][]): number[][] {
  const r: number[][] = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 2; k++) {
        r[i][j] += K[i][k] * H[k][j];
      }
    }
  }
  return r;
}