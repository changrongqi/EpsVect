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
import { createFpsCounter } from './util/fpsCounter';

const STATS_REFRESH_MS = 500;
const KPI_REFRESH_MS = 3000;

function main(): void {
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

  initRenderer('#trail-canvas', trailLength);

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

  function onMouseMove(e: MouseEvent): void {
    const processed = dataProcessor.process(e);

    directionDetector.pushMicroWindow(processed.smoothX, processed.smoothY);
    const dirResult = directionDetector.detect(processed.speed, processed.dx, processed.dy);

    if (processed.speed >= 5) {
      confidenceCalculator.pushTheta(dirResult.theta);
    } else {
      confidenceCalculator.clearHistory();
    }
    const confidence = confidenceCalculator.compute(processed.speed);

    if (processed.speed < 5) {
      driftDetector.push(processed.smoothX, processed.smoothY);
    } else {
      driftDetector.clear();
    }

    pushTrailPoint(
      { x: processed.noisyX, y: processed.noisyY },
      { x: processed.smoothX, y: processed.smoothY },
    );

    setPrediction({
      fromX: processed.smoothX,
      fromY: processed.smoothY,
      vx: processed.dx,
      vy: processed.dy,
      predX: processed.predX,
      predY: processed.predY,
      confidence,
      speed: processed.speed,
    });

    const kalmanVel = dataProcessor.getKalmanVelocity();
    panelRenderer.updateInfo({
      noisyX: processed.noisyX,
      noisyY: processed.noisyY,
      smoothX: processed.smoothX,
      smoothY: processed.smoothY,
      predX: processed.predX,
      predY: processed.predY,
      speed: processed.speed,
      kalmanVx: kalmanVel.vx,
      kalmanVy: kalmanVel.vy,
      thetaDeg: dirResult.smoothedTheta * 180 / Math.PI,
      confidence,
      lagDeg: dirResult.lagDeg,
      stateLabel: dirResult.stateLabel,
    });

    currentSpeed = processed.speed;
    currentLag = dirResult.lagDeg;
    currentConf = confidence;

    const predError = statsCollector.record(
      processed.speed,
      dirResult.lagDeg,
      confidence,
      currentFps,
      processed.smoothX,
      processed.smoothY,
      processed.predX,
      processed.predY,
    );
    currentPredErr = predError;

    historyRecorder.record({
      rawX: processed.noisyX,
      rawY: processed.noisyY,
      smoothX: processed.smoothX,
      smoothY: processed.smoothY,
      predX: processed.predX,
      predY: processed.predY,
      vx: processed.dx,
      vy: processed.dy,
      speed: processed.speed,
      theta: dirResult.theta,
      smoothedTheta: dirResult.smoothedTheta,
      confidence,
      state: dirResult.stateLabel,
      predError,
    });
  }

  let lastStatsRefresh = performance.now();
  let lastKpiRefresh = performance.now();
  let currentFps = 0;
  let currentSpeed = 0;
  let currentLag = 0;
  let currentConf = 0;
  let currentPredErr = 0;

  function animationLoop(): void {
    const fps = fpsCounter.tick();
    currentFps = fps;
    const drift = driftDetector.compute();

    panelRenderer.updateStats(fps, drift, getTrailLength());

    const now = performance.now();

    if (now - lastStatsRefresh >= STATS_REFRESH_MS) {
      lastStatsRefresh = now;
      const summary = statsCollector.summarize();
      panelRenderer.updateStatsPanel(
        summary,
        currentSpeed,
        currentLag,
        currentConf,
        currentPredErr,
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

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const frozen = freezeController.toggle();
      panelRenderer.setFrozen(frozen);
    }
  });

  sliderController.setInitialValues({
    noise: noiseStdDev,
    mincutoff,
    beta,
    trailLength,
    blend: parseInt(blendSlider.value, 10),
    q: kalmanQ,
    r: kalmanR,
  });

  document.addEventListener('mousemove', onMouseMove);
  requestAnimationFrame(animationLoop);
}

main();