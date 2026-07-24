export interface RingBuffer<T> {
  buffer: T[];
  writeIdx: number;
  count: number;
  capacity: number;
}

export function createRingBuffer<T>(capacity: number): RingBuffer<T> {
  return {
    buffer: new Array<T>(capacity),
    writeIdx: 0,
    count: 0,
    capacity,
  };
}

export function pushRing<T>(rb: RingBuffer<T>, item: T): void {
  if (rb.capacity === 0) return; // 防止 1 % 0 = NaN
  rb.buffer[rb.writeIdx] = item;
  rb.writeIdx = (rb.writeIdx + 1) % rb.capacity;
  if (rb.count < rb.capacity) rb.count++;
}

export function getRingCount<T>(rb: RingBuffer<T>): number {
  return rb.count;
}

export function getRingAt<T>(rb: RingBuffer<T>, index: number): T {
  // L8：capacity=0 或 index 越界时显式返回 undefined，避免 0%0=NaN 导致索引错误
  if (rb.capacity === 0 || index < 0 || index >= rb.count) {
    return undefined as unknown as T;
  }
  const idx = (rb.writeIdx - rb.count + index + rb.capacity) % rb.capacity;
  return rb.buffer[idx];
}

export function clearRing<T>(rb: RingBuffer<T>): void {
  rb.count = 0;
  rb.writeIdx = 0;
}

export function resizeRing<T>(rb: RingBuffer<T>, newCapacity: number): RingBuffer<T> {
  const newBuf = createRingBuffer<T>(newCapacity);
  const copyCount = Math.min(rb.count, newCapacity);
  const startIdx = rb.count - copyCount;
  for (let i = 0; i < copyCount; i++) {
    newBuf.buffer[i] = getRingAt(rb, startIdx + i);
  }
  // 防止 0 % 0 = NaN
  newBuf.writeIdx = newCapacity > 0 ? copyCount % newCapacity : 0;
  newBuf.count = copyCount;
  return newBuf;
}

export function toArray<T>(rb: RingBuffer<T>): T[] {
  const arr: T[] = new Array(rb.count);
  for (let i = 0; i < rb.count; i++) {
    arr[i] = getRingAt(rb, i);
  }
  return arr;
}
