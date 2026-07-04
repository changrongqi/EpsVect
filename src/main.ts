/**
 * EpsVect 主入口
 * 纯应用编排层：仅负责模块实例化、事件注册和数据流编排
 */

import { DataProcessor } from './processor/dataProcessor';
import { DirectionDetector } from './detector/directionDetector';
import { ConfidenceCalculator } from './detector/confidenceCalculator';
import { DriftDetector } from './detector/driftDetector';
import { StatsCollector } from './debug/statsCollector';
import { HistoryRecorder } from './debug/historyRecorder';
import { QualityAnalyzer } from './debug/qualityAnalyzer';
import { SliderController } from './ui/sliderController';
import { FreezeController } from './ui/freezeController';
import { PanelRenderer } from './ui/panelRenderer';
import { initRenderer, pushTrailPoint, renderFrame, setMaxTrailLength, getTrailLength, setPrediction } from './renderer/canvas';
import { initStarryBackground } from './renderer/starry';
import { createFpsCounter } from './util/fpsCounter';
import { MousePipeline, PipelineResult } from './core/pipeline';

const STATS_REFRESH_MS = 500;
const KPI_REFRESH_MS = 3000;

function main(): void {
  // ── DOM 元素获取 ──
  const noiseSlider = document.getElementById('noise-slider') as HTMLInputElement;
  const mincutoffSlider = document.getElementById('mincutoff-slider') as HTMLInputElement;
  const betaSlider = document.getElementById('beta-slider') as HTMLInputElement;
  const trailSlider = document.getElementById('trail-slider') as HTMLInputElement;
  const blendSlider = document.getElementById('blend-slider') as HTMLInputElement;
  const qSlider = document.getElementById('q-slider') as HTMLInputElement;
  const rSlider = document.getElementById('r-slider') as HTMLInputElement;

  const noiseStdDev = parseFloat(noiseSlider.value);
  const mincutoff = parseFloat(mincutoffSlider.value);
  const beta = parseFloat(betaSlider.value);
  const trailLength = parseInt(trailSlider.value, 10);
  const blendRatio = parseInt(blendSlider.value, 10) / 100;
  const kalmanQ = parseInt(qSlider.value, 10);
  const kalmanR = parseInt(rSlider.value, 10);

  // ── 模块实例化 ──
  const dataProcessor = new DataProcessor({
    noiseStdDev,
    mincutoff,
    beta,
    kalmanQ,
    kalmanR,
    blendRatio,
  });

  const directionDetector = new DirectionDetector();
  const confidenceCalculator = new ConfidenceCalculator();
  const driftDetector = new DriftDetector();
  const statsCollector = new StatsCollector(1000);
  const historyRecorder = new HistoryRecorder(600);
  const qualityAnalyzer = new QualityAnalyzer();
  const fpsCounter = createFpsCounter();

  const pipeline = new MousePipeline(
    dataProcessor,
    directionDetector,
    confidenceCalculator,
    driftDetector,
    statsCollector,
  );

  // ── 渲染器初始化 ──
  initRenderer('#trail-canvas', trailLength);
  initStarryBackground('#starry-canvas');

  // ── UI 控制器初始化 ──
  const sliderController = new SliderController(
    {
      noiseSlider,
      noiseValueEl: document.getElementById('noise-value')!,
      mincutoffSlider,
      mincutoffValueEl: document.getElementById('mincutoff-value')!,
      betaSlider,
      betaValueEl: document.getElementById('beta-value')!,
      trailSlider,
      trailValueEl: document.getElementById('trail-value')!,
      blendSlider,
      blendValueEl: document.getElementById('blend-value')!,
      qSlider,
      qValueEl: document.getElementById('q-value')!,
      rSlider,
      rValueEl: document.getElementById('r-value')!,
    },
    {
      onNoiseChange: (value) => dataProcessor.updateNoise(value),
      onMincutoffChange: (value) => dataProcessor.updateMincutoff(value),
      onBetaChange: (value) => dataProcessor.updateBeta(value),
      onTrailLengthChange: (value) => setMaxTrailLength(value),
      onBlendChange: (value) => dataProcessor.updateBlendRatio(value),
      onQChange: (value) => dataProcessor.updateKalmanQ(value),
      onRChange: (value) => dataProcessor.updateKalmanR(value),
    },
  );

  sliderController.setInitialValues({
    noise: noiseStdDev,
    mincutoff,
    beta,
    trailLength,
    blend: parseInt(blendSlider.value, 10),
    q: kalmanQ,
    r: kalmanR,
  });

  const freezeController = new FreezeController({
    infoPanel: document.getElementById('info-panel')!,
    freezeIndicatorEl: document.getElementById('freeze-indicator')!,
  });

  const panelRenderer = new PanelRenderer(
    {
      rawCoordsEl: document.getElementById('raw-coords')!,
      smoothCoordsEl: document.getElementById('smooth-coords')!,
      predCoordsEl: document.getElementById('pred-coords')!,
      speedDisplayEl: document.getElementById('speed-display')!,
      kalmanVelEl: document.getElementById('kalman-vel')!,
      thetaDisplayEl: document.getElementById('theta-display')!,
      confidenceDisplayEl: document.getElementById('confidence-display')!,
      thetaLagEl: document.getElementById('theta-lag')!,
      stateDisplayEl: document.getElementById('state-display')!,
      driftDisplayEl: document.getElementById('drift-display')!,
      trailLengthEl: document.getElementById('trail-length')!,
      fpsDisplayEl: document.getElementById('fps-display')!,
    },
    { historyRecorder },
  );

  // ── 运行时状态 ──
  let lastResult: PipelineResult | null = null;
  let currentFps = 60;
  let lastStatsRefresh = performance.now();
  let lastKpiRefresh = performance.now();

  // ── 鼠标移动处理 ──
  function onMouseMove(e: MouseEvent): void {
    const result = pipeline.process(e, currentFps);
    lastResult = result;

    pushTrailPoint(result.noisy, result.smooth);
    setPrediction(result.prediction);
    panelRenderer.updateInfo(result.panelData);
    historyRecorder.record(result.historyEntry);
  }

  // ── 动画循环调度 ──
  function animationLoop(): void {
    currentFps = fpsCounter.tick();
    const drift = driftDetector.compute();

    panelRenderer.updateStats(currentFps, drift, getTrailLength());

    const now = performance.now();

    if (lastResult && now - lastStatsRefresh >= STATS_REFRESH_MS) {
      lastStatsRefresh = now;
      const summary = statsCollector.summarize();
      panelRenderer.updateStatsPanel(
        summary,
        lastResult.speed,
        lastResult.lagDeg,
        lastResult.confidence,
        lastResult.predError,
        currentFps,
      );
    }

    if (now - lastKpiRefresh >= KPI_REFRESH_MS) {
      lastKpiRefresh = now;
      const kpi = qualityAnalyzer.analyze(historyRecorder.getEntries());
      panelRenderer.updateKPI(kpi);
    }

    renderFrame();
    requestAnimationFrame(animationLoop);
  }

  // ── 系统事件绑定 ──
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const frozen = freezeController.toggle();
      panelRenderer.setFrozen(frozen);
    }
  });

  document.addEventListener('mousemove', onMouseMove);
  requestAnimationFrame(animationLoop);
}

main();