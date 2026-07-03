/**
 * 历史记录器
 * 环形缓冲区记录运行数据，支持 JSON 导出
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

  /** 距离上次采样的事件数（降采样） */
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

  /** 导出为 JSON 字符串 */
  exportJSON(): string {
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.writeIdx - 1 - i + this.buffer.length) % this.buffer.length;
      entries.unshift(this.buffer[idx]);
    }
    return JSON.stringify(entries, null, 2);
  }

  /** 导出为 CSV 字符串 */
  exportCSV(): string {
    const headers = 'timestamp,rawX,rawY,smoothX,smoothY,predX,predY,vx,vy,speed,theta,smoothedTheta,confidence,state,predError';
    const rows: string[] = [headers];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.writeIdx - 1 - i + this.buffer.length) % this.buffer.length;
      const e = this.buffer[idx];
      rows.push([
        e.timestamp,
        e.rawX, e.rawY, e.smoothX, e.smoothY, e.predX, e.predY,
        e.vx, e.vy, e.speed, e.theta, e.smoothedTheta,
        e.confidence, e.state, e.predError,
      ].join(','));
    }
    return rows.join('\n');
  }

  /** 触发文件下载 */
  static downloadJSON(json: string, filename: string = 'epsvect-data.json'): void {
    HistoryRecorder.download(json, filename, 'application/json');
  }

  static downloadCSV(csv: string, filename: string = 'epsvect-data.csv'): void {
    HistoryRecorder.download(csv, filename, 'text/csv');
  }

  private static download(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** 获取所有有效记录（按时间顺序） */
  getEntries(): HistoryEntry[] {
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.writeIdx - 1 - i + this.buffer.length) % this.buffer.length;
      entries.unshift(this.buffer[idx]);
    }
    return entries;
  }
}