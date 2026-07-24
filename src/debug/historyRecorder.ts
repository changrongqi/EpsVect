import { createRingBuffer, pushRing, getRingCount, getRingAt, clearRing } from '../util/ringBuffer';

export interface HistoryEntry {
  timestamp: number;
  rawX: number;
  rawY: number;
  smoothX: number;
  smoothY: number;
  predX: number;
  predY: number;
  vx: number;
  vy: number;
  speed: number;
  theta: number;
  smoothedTheta: number;
  confidence: number;
  state: string;
  predError: number;
}

export class HistoryRecorder {
  private readonly buffer;
  private recording = true;
  private sampleCounter = 0;
  private readonly sampleRate: number;

  constructor(capacity: number = 600, sampleRate: number = 1) {
    this.buffer = createRingBuffer<HistoryEntry>(capacity);
    this.sampleRate = sampleRate;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  start(): void {
    this.recording = true;
  }

  stop(): void {
    this.recording = false;
  }

  clear(): void {
    clearRing(this.buffer);
  }

  record(entry: Omit<HistoryEntry, 'timestamp'>): void {
    if (!this.recording) return;

    this.sampleCounter++;
    if (this.sampleCounter < this.sampleRate) return;
    this.sampleCounter = 0;

    pushRing(this.buffer, { ...entry, timestamp: performance.now() });
  }

  exportJSON(): string {
    const entries = this.getEntries();
    return JSON.stringify(entries, null, 2);
  }

  exportCSV(): string {
    const headers = 'timestamp,rawX,rawY,smoothX,smoothY,predX,predY,vx,vy,speed,theta,smoothedTheta,confidence,state,predError';
    const rows: string[] = [headers];
    const entries = this.getEntries();
    for (const e of entries) {
      rows.push([
        e.timestamp,
        e.rawX, e.rawY, e.smoothX, e.smoothY, e.predX, e.predY,
        e.vx, e.vy, e.speed, e.theta, e.smoothedTheta,
        e.confidence, e.state, e.predError,
      ].join(','));
    }
    return rows.join('\n');
  }

  getEntries(): HistoryEntry[] {
    const count = getRingCount(this.buffer);
    const entries: HistoryEntry[] = new Array(count);
    for (let i = 0; i < count; i++) {
      entries[i] = getRingAt(this.buffer, i);
    }
    return entries;
  }
}
