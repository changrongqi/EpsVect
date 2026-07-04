/**
 * 面板渲染器
 * 负责所有 UI 面板内容的渲染更新和 UI 事件绑定
 */

import { StatsSummary } from '../debug/statsCollector';
import { QualityKPI } from '../debug/qualityAnalyzer';
import { HistoryRecorder } from '../debug/historyRecorder';

export interface PanelRendererConfig {
  rawCoordsEl: HTMLElement;
  smoothCoordsEl: HTMLElement;
  predCoordsEl: HTMLElement;
  speedDisplayEl: HTMLElement;
  kalmanVelEl: HTMLElement;
  thetaDisplayEl: HTMLElement;
  confidenceDisplayEl: HTMLElement;
  thetaLagEl: HTMLElement;
  stateDisplayEl: HTMLElement;
  driftDisplayEl: HTMLElement;
  trailLengthEl: HTMLElement;
  fpsDisplayEl: HTMLElement;
}

export interface PanelRendererOptions {
  historyRecorder?: HistoryRecorder;
}

export interface PanelUpdateData {
  noisyX: number;
  noisyY: number;
  smoothX: number;
  smoothY: number;
  predX: number;
  predY: number;
  speed: number;
  kalmanVx: number;
  kalmanVy: number;
  thetaDeg: number;
  confidence: number;
  lagDeg: number;
  stateLabel: string;
}

const STATE_LABELS: Record<string, string> = {
  still: '静止',
  micro: '微位移',
  slow: '慢速',
  medium: '中速',
  fast: '快速',
  turning: '变向中',
};

export class PanelRenderer {
  private config: PanelRendererConfig;
  private frozen = false;
  private historyRecorder?: HistoryRecorder;

  constructor(config: PanelRendererConfig, options?: PanelRendererOptions) {
    this.config = config;
    this.historyRecorder = options?.historyRecorder;
    this.initEventHandlers();
  }

  private initEventHandlers(): void {
    this.initCollapseHandlers();
    this.initExportHandlers();
  }

  private initCollapseHandlers(): void {
    document.querySelectorAll('.panel-header').forEach((header) => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        if (section) section.classList.toggle('collapsed');
      });
    });
  }

  private initExportHandlers(): void {
    if (!this.historyRecorder) return;

    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      HistoryRecorder.downloadJSON(this.historyRecorder!.exportJSON());
    });

    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      HistoryRecorder.downloadCSV(this.historyRecorder!.exportCSV());
    });

    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      this.historyRecorder!.clear();
    });
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  updateInfo(data: PanelUpdateData): void {
    if (this.frozen) return;
    const { rawCoordsEl, smoothCoordsEl, predCoordsEl, speedDisplayEl, kalmanVelEl, thetaDisplayEl,
            confidenceDisplayEl, thetaLagEl, stateDisplayEl } = this.config;

    rawCoordsEl.textContent = `(${data.noisyX.toFixed(1)}, ${data.noisyY.toFixed(1)})`;
    smoothCoordsEl.textContent = `(${data.smoothX.toFixed(1)}, ${data.smoothY.toFixed(1)})`;
    predCoordsEl.textContent = `(${data.predX.toFixed(1)}, ${data.predY.toFixed(1)})`;
    speedDisplayEl.textContent = `${Math.round(data.speed)} px/s`;
    kalmanVelEl.textContent = `(${data.kalmanVx.toFixed(0)}, ${data.kalmanVy.toFixed(0)}) px/s`;
    thetaDisplayEl.textContent = `${data.thetaDeg.toFixed(1)}°`;
    confidenceDisplayEl.textContent = data.confidence.toFixed(3);
    thetaLagEl.textContent = `${data.lagDeg.toFixed(1)}°`;
    stateDisplayEl.textContent = STATE_LABELS[data.stateLabel] || data.stateLabel;
  }

  updateStats(fps: number, drift: number, trailLength: number): void {
    if (this.frozen) return;
    this.config.fpsDisplayEl.textContent = String(fps);
    this.config.driftDisplayEl.textContent = `${drift.toFixed(2)} px`;
    this.config.trailLengthEl.textContent = String(trailLength);
  }

  updateStatsPanel(summary: StatsSummary, speed: number, lag: number, conf: number, predErr: number, fps: number): void {
    setText('stat-speed-cur', `${Math.round(speed)}`);
    setText('stat-speed-avg', `${Math.round(summary.speedAvg)}`);
    setText('stat-speed-max', `${Math.round(summary.speedMax)}`);
    setText('stat-speed-min', `${Math.round(summary.speedMin)}`);
    setText('stat-lag-cur', `${lag.toFixed(1)}`);
    setText('stat-lag-avg', `${summary.lagAvg.toFixed(1)}`);
    setText('stat-lag-max', `${summary.lagMax.toFixed(1)}`);
    setText('stat-lag-min', `${summary.lagMin.toFixed(1)}`);
    setText('stat-conf-cur', conf.toFixed(3));
    setText('stat-conf-avg', summary.confAvg.toFixed(3));
    setText('stat-conf-max', summary.confMax.toFixed(3));
    setText('stat-conf-min', summary.confMin.toFixed(3));
    setText('stat-prederr-cur', predErr.toFixed(1));
    setText('stat-prederr-avg', summary.predErrorAvg.toFixed(1));
    setText('stat-prederr-max', summary.predErrorMax.toFixed(1));
    setText('stat-prederr-min', summary.predErrorMin.toFixed(1));
    setText('stat-fps-cur', String(fps));
    setText('stat-fps-avg', `${Math.round(summary.fpsAvg)}`);
    setText('stat-fps-max', `${summary.fpsMax}`);
    setText('stat-fps-min', `${summary.fpsMin}`);
  }

  updateKPI(kpi: QualityKPI): void {
    setText('kpi-accuracy', `${kpi.directionAccuracy.toFixed(1)}°`);
    setText('kpi-prederr', `${kpi.predErrorMean.toFixed(1)} px`);
    setText('kpi-latency', `${kpi.responseLatency.toFixed(1)} 帧`);
    setText('kpi-stability', `${kpi.stabilityStd.toFixed(2)} px`);
    setText('kpi-score', String(kpi.followScore));
  }
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}