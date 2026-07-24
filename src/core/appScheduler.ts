/**
 * 应用调度器
 * 封装动画循环、静止检测、衰减逻辑、面板更新节流
 */

import { PipelineResult } from './pipeline';
import { DriftDetector } from '../detector/driftDetector';
import { StatsCollector } from '../debug/statsCollector';
import { QualityAnalyzer } from '../debug/qualityAnalyzer';
import { HistoryRecorder } from '../debug/historyRecorder';
import { PanelRenderer } from '../ui/panelRenderer';
import { createFpsCounter } from '../util/fpsCounter';
import { getTrailLength, renderFrame } from '../renderer/canvas';
import { setStarryParallax } from '../renderer/starry';
import { DataProcessor } from '../processor/dataProcessor';

const STATS_REFRESH_MS = 500;
const KPI_REFRESH_MS = 3000;
const PANEL_UPDATE_MS = 30;

interface AppSchedulerOptions {
  driftDetector: DriftDetector;
  statsCollector: StatsCollector;
  qualityAnalyzer: QualityAnalyzer;
  historyRecorder: HistoryRecorder;
  panelRenderer: PanelRenderer;
  dataProcessor: DataProcessor;
  onStarryParallax: (theta: number, confidence: number) => void;
  isHomeMode: () => boolean;
  onExtraUpdate?: (isHome: boolean, isStill: boolean, now: number) => void;
  onFpsUpdate?: (fps: number) => void;
}

export class AppScheduler {
  private animationId = 0;
  private fpsCounter = createFpsCounter();
  private lastResult: PipelineResult | null = null;
  private currentFps = 60;
  private lastStatsRefresh = performance.now();
  private lastKpiRefresh = performance.now();
  private lastPanelUpdateTime = 0;
  private lastMouseMoveTime = performance.now();
  private lastFrameTime = performance.now();

  private readonly driftDetector: DriftDetector;
  private readonly statsCollector: StatsCollector;
  private readonly qualityAnalyzer: QualityAnalyzer;
  private readonly historyRecorder: HistoryRecorder;
  private readonly panelRenderer: PanelRenderer;
  private readonly dataProcessor: DataProcessor;
  private readonly onStarryParallax: (theta: number, confidence: number) => void;
  private readonly isHomeMode: () => boolean;
  private readonly onExtraUpdate?: (isHome: boolean, isStill: boolean, now: number) => void;
  private readonly onFpsUpdate?: (fps: number) => void;

  constructor(options: AppSchedulerOptions) {
    this.driftDetector = options.driftDetector;
    this.statsCollector = options.statsCollector;
    this.qualityAnalyzer = options.qualityAnalyzer;
    this.historyRecorder = options.historyRecorder;
    this.panelRenderer = options.panelRenderer;
    this.dataProcessor = options.dataProcessor;
    this.onStarryParallax = options.onStarryParallax;
    this.isHomeMode = options.isHomeMode;
    this.onExtraUpdate = options.onExtraUpdate;
    this.onFpsUpdate = options.onFpsUpdate;
  }

  setLastResult(result: PipelineResult): void {
    this.lastResult = result;
  }

  onMouseMove(): void {
    this.lastMouseMoveTime = performance.now();
  }

  private animationLoop = (now: number): void => {
    this.currentFps = this.fpsCounter.tick();
    if (this.onFpsUpdate) {
      this.onFpsUpdate(this.currentFps);
    }
    const drift = this.driftDetector.compute();

    this.panelRenderer.updateStats(this.currentFps, drift, getTrailLength());

    const isHome = this.isHomeMode();

    const isStill = (now - this.lastMouseMoveTime) > 16;

    if (this.lastResult && isStill) {
      // 鼠标停止时保留停止前的瞬时速度，不做衰减
      // 只更新状态标签和面板显示
      if (this.lastResult.speed < 1) {
        this.lastResult.panelData.stateLabel = 'still';
      }
      if (now - this.lastPanelUpdateTime >= PANEL_UPDATE_MS) {
        this.panelRenderer.updateInfo(this.lastResult.panelData);
        this.lastPanelUpdateTime = now;
      }
    }

    if (this.lastResult && !isStill) {
      const theta = this.lastResult.prediction.vx !== 0 || this.lastResult.prediction.vy !== 0
        ? Math.atan2(this.lastResult.prediction.vy, this.lastResult.prediction.vx)
        : 0;
      this.onStarryParallax(theta, this.lastResult.confidence);
    } else {
      this.onStarryParallax(0, 0);
    }

    if (this.lastResult && now - this.lastStatsRefresh >= STATS_REFRESH_MS) {
      this.lastStatsRefresh = now;
      const summary = this.statsCollector.summarize();
      this.panelRenderer.updateStatsPanel(
        summary,
        this.lastResult.speed,
        this.lastResult.lagDeg,
        this.lastResult.confidence,
        this.lastResult.predError,
        this.currentFps,
      );
    }

    if (now - this.lastKpiRefresh >= KPI_REFRESH_MS) {
      this.lastKpiRefresh = now;
      const kpi = this.qualityAnalyzer.analyze(this.historyRecorder.getEntries());
      this.panelRenderer.updateKPI(kpi);
    }

    if (this.onExtraUpdate) {
      this.onExtraUpdate(isHome, isStill, now);
    }

    renderFrame();
    this.lastFrameTime = now;
    this.animationId = requestAnimationFrame(this.animationLoop);
  };

  start(): void {
    this.animationId = requestAnimationFrame(this.animationLoop);
  }

  stop(): void {
    cancelAnimationFrame(this.animationId);
  }
}