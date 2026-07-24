import { createRingBuffer, pushRing, getRingCount, clearRing, getRingAt } from '../util/ringBuffer';

interface Point {
  x: number;
  y: number;
}

const MAX_HISTORY = 120;

export class DriftDetector {
  private buffer = createRingBuffer<Point>(MAX_HISTORY);

  push(x: number, y: number): void {
    pushRing(this.buffer, { x, y });
  }

  clear(): void {
    clearRing(this.buffer);
  }

  compute(): number {
    const count = getRingCount(this.buffer);
    if (count < 2) return 0;

    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < count; i++) {
      const p = getRingAt(this.buffer, i);
      sumX += p.x;
      sumY += p.y;
    }
    const avgX = sumX / count;
    const avgY = sumY / count;

    let maxDrift = 0;
    for (let i = 0; i < count; i++) {
      const p = getRingAt(this.buffer, i);
      const dx = p.x - avgX;
      const dy = p.y - avgY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDrift) maxDrift = dist;
    }
    return maxDrift;
  }

  reset(): void {
    clearRing(this.buffer);
  }
}
