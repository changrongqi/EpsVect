const TWO_PI = Math.PI * 2;

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function angleDiffDeg(a: number, b: number): number {
  let diff = Math.abs(a - b);
  return diff > 180 ? 360 - diff : diff;
}

export function angleDiffRad(a: number, b: number): number {
  let diff = Math.abs(a - b);
  return diff > Math.PI ? TWO_PI - diff : diff;
}

export function shortestAngleDiff(target: number, current: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;
  return diff;
}

export function circularMean(angles: number[], count: number): number {
  if (count === 0) return 0;
  let sumSin = 0;
  let sumCos = 0;
  for (let i = 0; i < count; i++) {
    sumSin += Math.sin(angles[i]);
    sumCos += Math.cos(angles[i]);
  }
  return Math.atan2(sumSin, sumCos);
}

export function circularStdDev(angles: number[], count: number): number {
  if (count < 2) return 0;
  let sumSin = 0;
  let sumCos = 0;
  for (let i = 0; i < count; i++) {
    sumSin += Math.sin(angles[i]);
    sumCos += Math.cos(angles[i]);
  }
  const R = Math.sqrt(sumSin * sumSin + sumCos * sumCos) / count;
  return Math.sqrt(-2 * Math.log(Math.max(R, 0.001)));
}

export function emaAngle(current: number, prev: number, alpha: number): number {
  const sinSum = alpha * Math.sin(current) + (1 - alpha) * Math.sin(prev);
  const cosSum = alpha * Math.cos(current) + (1 - alpha) * Math.cos(prev);
  return Math.atan2(sinSum, cosSum);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr: number[], mean: number): number {
  if (arr.length < 2) return 0;
  const sqDiffs = arr.map((v) => (v - mean) * (v - mean));
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / arr.length);
}
