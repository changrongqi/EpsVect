/**
 * 历史记录器
 * 环形缓冲区记录运行数据，支持 JSON/CSV 格式导出字符串
 */

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
  private readonly buffer: HistoryEntry[];
  private writeIdx = 0;
  private count = 0;
  private recording = true;

  private sampleCounter = 0;
  private readonly sampleRate: number;

  constructor(capacity: number = 600, sampleRate: number = 1) {
    this.buffer = new Array<HistoryEntry>(capacity);
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
    this.writeIdx = 0;
    this.count = 0;
  }

  record(entry: Omit<HistoryEntry, 'timestamp'>): void {
    if (!this.recording) return;

    this.sampleCounter++;
    if (this.sampleCounter < this.sampleRate) return;
    this.sampleCounter = 0;

    this.buffer[this.writeIdx] = { ...entry, timestamp: performance.now() };
    this.writeIdx = (this.writeIdx + 1) % this.buffer.length;
    if (this.count < this.buffer.length) this.count++;
  }

  exportJSON(): string {
    const entries = this.getAllEntries();
    return JSON.stringify(entries, null, 2);
  }

  exportCSV(): string {
    const headers = 'timestamp,rawX,rawY,smoothX,smoothY,predX,predY,vx,vy,speed,theta,smoothedTheta,confidence,state,predError';
    const rows: string[] = [headers];
    const entries = this.getAllEntries();
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
    return this.getAllEntries();
  }

  private getAllEntries(): HistoryEntry[] {
    const entries: HistoryEntry[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const idx = (this.writeIdx - this.count + i + this.buffer.length) % this.buffer.length;
      entries[i] = this.buffer[idx];
    }
    return entries;
  }
}