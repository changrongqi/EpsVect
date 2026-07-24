import {
  TrailBuffer,
  createTrailBuffer,
  pushToBuffer,
  getBufferLength,
  clearBuffer,
  resizeBuffer,
  type TrailPoint,
} from './trailBuffer';
import {
  EntryRenderData,
  projectEntries,
  renderEntries,
  getHighlightedEntry as getHighlighted,
  // L19：复用 entryRenderer 的 ProjectedEntry，避免重复定义与 as 桥接
  type ProjectedEntry,
} from './entryRenderer';
import { drawAlgoTestView, type PredictionData } from './trailRenderer';

export type { TrailPoint, EntryRenderData, PredictionData, ProjectedEntry };

export type ViewMode = 'home' | 'algo-test' | 'sub';

interface RendererState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rawTrail: TrailBuffer;
  smoothTrail: TrailBuffer;
  maxTrailLength: number;
  savedTrailLength: number;
  prediction: PredictionData | null;
  entries: ProjectedEntry[];
  viewMode: ViewMode;
}

let state: RendererState | null = null;
// 保存 resize 监听器引用，多次 init 时先移除旧监听器，避免 HMR 累积
let resizeHandler: (() => void) | null = null;

export function initRenderer(
  canvasSelector: string,
  maxTrailLength: number = 100,
): CanvasRenderingContext2D {
  const canvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
  if (!canvas) throw new Error(`Canvas not found: ${canvasSelector}`);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context not available');

  // 移除旧 resize 监听器（HMR 或重复 init 场景）
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }
  resizeHandler = () => resizeCanvas(canvas, ctx);
  window.addEventListener('resize', resizeHandler);

  resizeCanvas(canvas, ctx);

  state = {
    canvas,
    ctx,
    rawTrail: createTrailBuffer(maxTrailLength),
    smoothTrail: createTrailBuffer(maxTrailLength),
    maxTrailLength,
    savedTrailLength: maxTrailLength,
    prediction: null,
    entries: [],
    viewMode: 'home',
  };
  return ctx;
}

function resizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function pushTrailPoint(raw: TrailPoint, smooth: TrailPoint): void {
  if (!state) return;
  pushToBuffer(state.rawTrail, raw);
  pushToBuffer(state.smoothTrail, smooth);
}

export function setMaxTrailLength(length: number): void {
  if (!state) return;

  if (length !== state.maxTrailLength) {
    state.rawTrail = resizeBuffer(state.rawTrail, length);
    state.smoothTrail = resizeBuffer(state.smoothTrail, length);
    state.maxTrailLength = length;
    if (state.viewMode === 'algo-test') {
      state.savedTrailLength = length;
    }
  }
}

export function getTrailLength(): number {
  if (!state) return 0;
  return getBufferLength(state.rawTrail);
}

export function setPrediction(data: PredictionData | null): void {
  if (state) state.prediction = data;
}

export function clearTrailData(): void {
  if (!state) return;
  clearBuffer(state.rawTrail);
  clearBuffer(state.smoothTrail);
  state.prediction = null;
}

export function setEntries(entries: EntryRenderData[]): void {
  if (!state) return;
  // L19：projectEntries 返回 ProjectedEntry[]，无需再 as 桥接
  // L18：projectEntries 内部已用对象池，不再每帧分配新数组/对象
  state.entries = projectEntries(entries);
}

export function getHighlightedEntry(): string | null {
  if (!state || state.entries.length === 0) return null;
  return getHighlighted(state.entries);
}

export function setViewMode(mode: ViewMode): void {
  if (!state) return;
  const prev = state.viewMode;
  state.viewMode = mode;
  if (mode === 'home') {
    if (prev === 'algo-test') {
      state.savedTrailLength = state.maxTrailLength;
    }
    setMaxTrailLength(15);
  } else if (mode === 'algo-test') {
    setMaxTrailLength(state.savedTrailLength);
  } else {
    // sub 模式：清理所有残留数据，确保子界面视觉隔离
    setMaxTrailLength(0);
    state.prediction = null;
    state.entries = [];
  }
}

export function renderFrame(): void {
  if (!state) return;
  const { ctx, rawTrail, smoothTrail, prediction, viewMode, entries } = state;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (viewMode === 'sub') {
    return;
  }

  if (viewMode === 'home') {
    renderEntries(ctx, entries);
    return;
  }

  drawAlgoTestView(ctx, rawTrail, smoothTrail, prediction);
}

/**
 * 销毁渲染器：移除 resize 监听器并清理状态
 * HMR/应用卸载时调用，避免监听器累积与 state 引用残留
 */
export function destroyRenderer(): void {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  state = null;
}
