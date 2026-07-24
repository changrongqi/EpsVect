/**
 * 鼠标处理器
 * 封装鼠标移动事件处理、轨迹推送、面板更新
 */

import { MousePipeline, PipelineResult } from './pipeline';
import { PanelRenderer } from '../ui/panelRenderer';
import { HistoryRecorder } from '../debug/historyRecorder';
import { pushTrailPoint, setPrediction } from '../renderer/canvas';

const PANEL_UPDATE_MS = 30;

interface MouseHandlerOptions {
  pipeline: MousePipeline;
  panelRenderer: PanelRenderer;
  historyRecorder: HistoryRecorder;
  onResult: (result: PipelineResult) => void;
}

export class MouseHandler {
  private readonly pipeline: MousePipeline;
  private readonly panelRenderer: PanelRenderer;
  private readonly historyRecorder: HistoryRecorder;
  private readonly onResult: (result: PipelineResult) => void;
  private lastPanelUpdateTime = 0;
  private currentFps = 60;

  constructor(options: MouseHandlerOptions) {
    this.pipeline = options.pipeline;
    this.panelRenderer = options.panelRenderer;
    this.historyRecorder = options.historyRecorder;
    this.onResult = options.onResult;
  }

  setCurrentFps(fps: number): void {
    this.currentFps = fps;
  }

  onMouseMove(e: MouseEvent, isHome: boolean): void {
    const result = this.pipeline.process(e, this.currentFps);
    this.onResult(result);

    if (!isHome) {
      pushTrailPoint(result.noisy, result.smooth);
      setPrediction(result.prediction);
    }

    const now = performance.now();
    if (now - this.lastPanelUpdateTime >= PANEL_UPDATE_MS) {
      this.panelRenderer.updateInfo(result.panelData);
      this.lastPanelUpdateTime = now;
    }
    if (!isHome) {
      this.historyRecorder.record(result.historyEntry);
    }
  }
}