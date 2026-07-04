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
  private history: Point[] = [];

  push(x: number, y: number): void {
    this.history.push({ x, y });
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  clear(): void {
    this.history = [];
  }

  compute(): number {
    if (this.history.length < 2) return 0;
    const avgX = this.history.reduce((s, p) => s + p.x, 0) / this.history.length;
    const avgY = this.history.reduce((s, p) => s + p.y, 0) / this.history.length;
    let maxDrift = 0;
    for (const p of this.history) {
      const dx = p.x - avgX;
      const dy = p.y - avgY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDrift) maxDrift = dist;
    }
    return maxDrift;
  }

  reset(): void {
    this.history = [];
  }
}