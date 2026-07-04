/**
 * 漂移检测器
 * 检测鼠标静止时滤波坐标的最大偏移量
 */

interface Point {
  x: number;
  y: number;
}

const MAX_HISTORY = 120;

export class DriftDetector {
  private buffer: Point[] = new Array(MAX_HISTORY);
  private writeIdx = 0;
  private count = 0;

  push(x: number, y: number): void {
    this.buffer[this.writeIdx] = { x, y };
    this.writeIdx = (this.writeIdx + 1) % MAX_HISTORY;
    if (this.count < MAX_HISTORY) this.count++;
  }

  clear(): void {
    this.writeIdx = 0;
    this.count = 0;
  }

  compute(): number {
    if (this.count < 2) return 0;

    let sumX = 0, sumY = 0;
    for (let i = 0; i < this.count; i++) {
      const idx = (this.writeIdx - this.count + i + MAX_HISTORY) % MAX_HISTORY;
      const p = this.buffer[idx];
      sumX += p.x;
      sumY += p.y;
    }
    const avgX = sumX / this.count;
    const avgY = sumY / this.count;

    let maxDrift = 0;
    for (let i = 0; i < this.count; i++) {
      const idx = (this.writeIdx - this.count + i + MAX_HISTORY) % MAX_HISTORY;
      const p = this.buffer[idx];
      const dx = p.x - avgX;
      const dy = p.y - avgY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDrift) maxDrift = dist;
    }
    return maxDrift;
  }

  reset(): void {
    this.writeIdx = 0;
    this.count = 0;
  }
}