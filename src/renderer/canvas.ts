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
} from './entryRenderer';
import { drawAlgoTestView, type PredictionData } from './trailRenderer';

export type { TrailPoint, EntryRenderData, PredictionData };

export type ViewMode = 'home' | 'algo-test' | 'sub';

interface ProjectedEntry extends EntryRenderData {
  screenX: number;
  screenY: number;
  alpha: number;
  scale: number;
  driftTheta: number;
  driftPhi: number;
}

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

export function initRenderer(
  canvasSelector: string,
  maxTrailLength: number = 100,
): CanvasRenderingContext2D {
  const canvas = document.querySelector<HTMLCanvasElement>(canvasSelector);
  if (!canvas) throw new Error(`Canvas not found: ${canvasSelector}`);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context not available');

  resizeCanvas(canvas, ctx);
  window.addEventListener('resize', () => resizeCanvas(canvas, ctx));

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
  state.entries = projectEntries(entries) as ProjectedEntry[];
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
    setMaxTrailLength(0);
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
