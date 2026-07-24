export type Mat2 = number[][];
export type Mat4 = number[][];
export type Vec2 = [number, number];
export type Vec4 = [number, number, number, number];

export function identity4(): Mat4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

export function transpose4(m: Mat4): Mat4 {
  const r: Mat4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      r[i][j] = m[j][i];
    }
  }
  return r;
}

export function scaleMatrix(m: Mat4, s: number): Mat4 {
  return m.map((row) => row.map((v) => v * s));
}

export function addMat4(a: Mat4, b: Mat4): Mat4 {
  const r: Mat4 = [];
  for (let i = 0; i < 4; i++) {
    r[i] = [];
    for (let j = 0; j < 4; j++) {
      r[i][j] = a[i][j] + b[i][j];
    }
  }
  return r;
}

export function subMat4(a: Mat4, b: Mat4): Mat4 {
  const r: Mat4 = [];
  for (let i = 0; i < 4; i++) {
    r[i] = [];
    for (let j = 0; j < 4; j++) {
      r[i][j] = a[i][j] - b[i][j];
    }
  }
  return r;
}

export function mulMat4(a: Mat4, b: Mat4): Mat4 {
  const r: Mat4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        r[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return r;
}

export function mulMatVec4(A: Mat4, v: Vec4): Vec4 {
  return [
    A[0][0] * v[0] + A[0][1] * v[1] + A[0][2] * v[2] + A[0][3] * v[3],
    A[1][0] * v[0] + A[1][1] * v[1] + A[1][2] * v[2] + A[1][3] * v[3],
    A[2][0] * v[0] + A[2][1] * v[1] + A[2][2] * v[2] + A[2][3] * v[3],
    A[3][0] * v[0] + A[3][1] * v[1] + A[3][2] * v[2] + A[3][3] * v[3],
  ];
}

export function mulMatVec2x4(H: Mat4, v: Vec4): Vec2 {
  return [
    H[0][0] * v[0] + H[0][1] * v[1] + H[0][2] * v[2] + H[0][3] * v[3],
    H[1][0] * v[0] + H[1][1] * v[1] + H[1][2] * v[2] + H[1][3] * v[3],
  ];
}

export function mulMat4x2Transpose(P: Mat4, H: Mat4): number[][] {
  const r: number[][] = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 4; k++) {
        r[i][j] += P[i][k] * H[j][k];
      }
    }
  }
  return r;
}

export function mulMat2x4x4x2(H: Mat4, P: Mat4, Ht: Mat4): Mat2 {
  const PHt = mulMat4x2Transpose(P, Ht);
  const r: Mat2 = [
    [0, 0],
    [0, 0],
  ];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 4; k++) {
        r[i][j] += H[i][k] * PHt[k][j];
      }
    }
  }
  return r;
}

export function addMat2x2(a: Mat2, b: Mat2): Mat2 {
  return [
    [a[0][0] + b[0][0], a[0][1] + b[0][1]],
    [a[1][0] + b[1][0], a[1][1] + b[1][1]],
  ];
}

export function inv2x2(m: Mat2): Mat2 {
  const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  // 奇异矩阵：返回零阵而非单位阵，使卡尔曼增益 K=0 忽略观测，避免静默发散
  if (Math.abs(det) < 1e-12) return [
    [0, 0],
    [0, 0],
  ];
  const invDet = 1 / det;
  return [
    [m[1][1] * invDet, -m[0][1] * invDet],
    [-m[1][0] * invDet, m[0][0] * invDet],
  ];
}

export function mulMat4x2x2x2(K: number[][], SInv: Mat2): number[][] {
  return [
    [K[0][0] * SInv[0][0] + K[0][1] * SInv[1][0], K[0][0] * SInv[0][1] + K[0][1] * SInv[1][1]],
    [K[1][0] * SInv[0][0] + K[1][1] * SInv[1][0], K[1][0] * SInv[0][1] + K[1][1] * SInv[1][1]],
    [K[2][0] * SInv[0][0] + K[2][1] * SInv[1][0], K[2][0] * SInv[0][1] + K[2][1] * SInv[1][1]],
    [K[3][0] * SInv[0][0] + K[3][1] * SInv[1][0], K[3][0] * SInv[0][1] + K[3][1] * SInv[1][1]],
  ];
}

export function mulMat4x2x2x4(K: number[][], H: Mat4): Mat4 {
  const r: Mat4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 2; k++) {
        r[i][j] += K[i][k] * H[k][j];
      }
    }
  }
  return r;
}

export function diag4(value: number): Mat4 {
  return [
    [value, 0, 0, 0],
    [0, value, 0, 0],
    [0, 0, value, 0],
    [0, 0, 0, value],
  ];
}

export function diag2(value: number): Mat2 {
  return [
    [value, 0],
    [0, value],
  ];
}
