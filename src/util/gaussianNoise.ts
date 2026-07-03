/**
 * 高斯噪声生成器（Box-Muller 变换）
 * 用于在原始坐标上叠加人工噪声，验证滤波器的降噪能力
 */
export function gaussianRandom(mean = 0, stdev = 1): number {
  let u = 1 - Math.random();
  let v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}