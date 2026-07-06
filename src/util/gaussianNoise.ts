/**
 * 高斯噪声生成器（Box-Muller 变换）
 * 用于在原始坐标上叠加人工噪声，验证滤波器的降噪能力
 */
export function gaussianRandom(mean = 0, stdev = 1): number {
  const u = Math.max(1 - Math.random(), Number.EPSILON);
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}