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
// L47/noUnusedLocals: setStarryParallax 由 bootstrap.ts 直接传入 onStarryParallax 回调，不在本模块导入；
// dataProcessor 字段未被 AppScheduler 内部使用，移除相关导入、字段与 options 配置项

const STATS_REFRESH_MS = 500;
const KPI_REFRESH_MS = 3000;
const PANEL_UPDATE_MS = 30;
// 鼠标静止检测阈值：50ms（约3帧@60Hz），避免单帧抖动导致状态闪烁
const STILL_THRESHOLD_MS = 50;

interface AppSchedulerOptions {
  driftDetector: DriftDetector;
  statsCollector: StatsCollector;
  qualityAnalyzer: QualityAnalyzer;
  historyRecorder: HistoryRecorder;
  panelRenderer: PanelRenderer;
  onStarryParallax: (theta: number, confidence: number) => void;
  isHomeMode: () => boolean;
  onExtraUpdate?: (isHome: boolean, isStill: boolean, now: number) => void;
  onFpsUpdate?: (fps: number) => void;
}

export class AppScheduler {
  private animationId = 0;
  // 运行态守卫：防止 start() 被重复调用导致多条 rAF 循环并存
  private running = false;
  private fpsCounter = createFpsCounter();
  private lastResult: PipelineResult | null = null;
  private currentFps = 60;
  private lastStatsRefresh = performance.now();
  private lastKpiRefresh = performance.now();
  private lastPanelUpdateTime = 0;
  // L2：updateStats（FPS/漂移/轨迹长度）独立节流时间戳，避免与 updateInfo 的 lastPanelUpdateTime 冲突
  private lastStatsUpdateTime = 0;
  private lastMouseMoveTime = performance.now();
  // L1：删除 lastFrameTime（写入但从不读取，死代码）

  private readonly driftDetector: DriftDetector;
  private readonly statsCollector: StatsCollector;
  private readonly qualityAnalyzer: QualityAnalyzer;
  private readonly historyRecorder: HistoryRecorder;
  private readonly panelRenderer: PanelRenderer;
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

    const isHome = this.isHomeMode();

    const isStill = (now - this.lastMouseMoveTime) > STILL_THRESHOLD_MS;

    // L2：updateStats（FPS/漂移/轨迹长度显示）无需每帧更新，用 PANEL_UPDATE_MS 节流
    // 使用独立时间戳 lastStatsUpdateTime，避免与 isStill 分支的 updateInfo 节流冲突
    if (now - this.lastStatsUpdateTime >= PANEL_UPDATE_MS) {
      this.panelRenderer.updateStats(this.currentFps, drift, getTrailLength());
      this.lastStatsUpdateTime = now;
    }

    if (this.lastResult && isStill) {
      // 鼠标停止时保留停止前的瞬时速度，不做衰减
      // 只更新状态标签和面板显示。使用浅拷贝避免突变共享对象
      if (now - this.lastPanelUpdateTime >= PANEL_UPDATE_MS) {
        const panelData = { ...this.lastResult.panelData };
        if (this.lastResult.speed < 1) {
          panelData.stateLabel = 'still';
        }
        this.panelRenderer.updateInfo(panelData);
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
    // L1：删除 this.lastFrameTime = now（死代码）
    this.animationId = requestAnimationFrame(this.animationLoop);
  };

  start(): void {
    // 守卫：重复调用直接返回，避免多条 rAF 链并存
    if (this.running) return;
    this.running = true;
    this.animationId = requestAnimationFrame(this.animationLoop);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.animationId);
    this.animationId = 0;
  }
}