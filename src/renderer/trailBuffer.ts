import { createRingBuffer, pushRing, getRingCount, getRingAt, clearRing, resizeRing, type RingBuffer } from '../util/ringBuffer';

export interface TrailPoint {
  x: number;
  y: number;
}

export interface TrailBuffer {
  _rb: RingBuffer<TrailPoint>;
}

export function createTrailBuffer(maxLength: number): TrailBuffer {
  return { _rb: createRingBuffer<TrailPoint>(maxLength) };
}

export function pushToBuffer(buffer: TrailBuffer, point: TrailPoint): void {
  pushRing(buffer._rb, point);
}

export function getBufferLength(buffer: TrailBuffer): number {
  return getRingCount(buffer._rb);
}

export function getBufferPoint(buffer: TrailBuffer, index: number): TrailPoint {
  return getRingAt(buffer._rb, index);
}

export function clearBuffer(buffer: TrailBuffer): void {
  clearRing(buffer._rb);
}

export function resizeBuffer(buffer: TrailBuffer, newLength: number): TrailBuffer {
  return { _rb: resizeRing(buffer._rb, newLength) };
}
