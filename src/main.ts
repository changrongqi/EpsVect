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
import { initRenderer, pushTrailPoint, renderFrame, setMaxTrailLength, getTrailLength, setPrediction, setHomeMode, setPortals, PortalData } from './renderer/canvas';
import { initStarryBackground, setStarryParallax, setStarryTendency, setStarryHomeMode } from './renderer/starry';
import { createFpsCounter } from './util/fpsCounter';
import { MousePipeline, PipelineResult } from './core/pipeline';
import { ViewSwitcher, ViewName } from './ui/viewSwitcher';
import { TendencyEngine } from './core/tendency';

const STATS_REFRESH_MS = 500;
const KPI_REFRESH_MS = 3000;
/** 倾向阈值：达到此值自动从主页进入子视图（值越高需要越坚定的方向） */
const TENDENCY_THRESHOLD = 0.92;

/** 入口配置 */
interface EntryConfig {
  id: string;
  angle: number;        // 弧度，从中心出发的角度
  label: string;
  dataView: ViewName;
}

/** 当前活跃的入口 */
const ENTRY_CONFIGS: EntryConfig[] = [
  { id: 'algo-test', angle: 0, label: '算法测试', dataView: 'algo-test' },
];

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
  let savedNoiseStdDev = noiseStdDev;  // 主页模式切回时恢复用
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

  // ── 倾向引擎 ──
  const tendencyEngine = new TendencyEngine();

  // ── 渲染器初始化 ──
  initRenderer('#trail-canvas', trailLength);
  initStarryBackground('#starry-canvas');

  // ── 视图切换器 ──
  const viewSwitcher = new ViewSwitcher();
  viewSwitcher.register('home', document.getElementById('home-view')!);
  viewSwitcher.register('algo-test', document.getElementById('algo-test-view')!);
  viewSwitcher.onSwitch((view) => {
    setHomeMode(view === 'home');
    setStarryHomeMode(view === 'home');
    tendencyEngine.reset();
  });
  setHomeMode(true);
  setStarryHomeMode(true);

  // 入口光点点击：切换到对应视图
  document.querySelectorAll<HTMLElement>('.home-entry[data-view]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.dataset.view as ViewName;
      viewSwitcher.switchTo(target);
    });
  });

  // 返回按钮：回到主页
  document.getElementById('back-btn')?.addEventListener('click', () => {
    viewSwitcher.switchTo('home');
  });

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
      onNoiseChange: (value) => { dataProcessor.updateNoise(value); savedNoiseStdDev = value; },
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
  let lastTendencyTime = performance.now();

  // ── 计算入口光门数据 ──
  function computePortalData(): PortalData[] {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const radius = 260;

    return ENTRY_CONFIGS.map((entry) => ({
      x: cx + radius * Math.cos(entry.angle),
      y: cy + radius * Math.sin(entry.angle),
      tendency: tendencyEngine.tendency,
      label: entry.label,
      angle: entry.angle,
    }));
  }

  // ── 鼠标移动处理 ──
  let lastMouseMoveTime = performance.now();
  let lastPanelUpdateTime = 0;
  function onMouseMove(e: MouseEvent): void {
    lastMouseMoveTime = performance.now();
    const result = pipeline.process(e, currentFps);
    lastResult = result;

    const isHome = viewSwitcher.getCurrentView() === 'home';

    if (isHome) {
      // 主页模式：不推轨迹，不渲染箭头/预测点
      // 仅保持管线运行以获取方向数据
    } else {
      pushTrailPoint(result.noisy, result.smooth);
      setPrediction(result.prediction);
    }

    // 面板更新节流：每 100ms 更新一次 DOM
    const now = performance.now();
    if (now - lastPanelUpdateTime >= 100) {
      panelRenderer.updateInfo(result.panelData);
      lastPanelUpdateTime = now;
    }
    historyRecorder.record(result.historyEntry);
  }

  // ── 动画循环调度 ──
  function animationLoop(now: number): void {
    currentFps = fpsCounter.tick();
    const drift = driftDetector.compute();
    const isHome = viewSwitcher.getCurrentView() === 'home';

    panelRenderer.updateStats(currentFps, drift, getTrailLength());

    // 主页模式：禁用噪声注入，确保极度顺滑
    dataProcessor.updateNoise(isHome ? 0 : savedNoiseStdDev);

    // 每帧实时判断静止：超过 16ms（一帧）无 mousemove 即静止
    const isStill = (now - lastMouseMoveTime) > 16;

    // 静止时：lastResult 实时衰减到 0，确保面板每帧反映真实状态
    if (lastResult && isStill) {
      const decayFactor = Math.exp(-8 * (now - lastMouseMoveTime) / 1000);
      // 原地修改，避免对象展开复制
      lastResult.speed *= decayFactor;
      lastResult.confidence *= decayFactor;
      lastResult.prediction.vx *= decayFactor;
      lastResult.prediction.vy *= decayFactor;
      lastResult.prediction.speed *= decayFactor;
      lastResult.prediction.confidence *= decayFactor;
      lastResult.panelData.speed *= decayFactor;
      lastResult.panelData.kalmanVx *= decayFactor;
      lastResult.panelData.kalmanVy *= decayFactor;
      lastResult.panelData.confidence *= decayFactor;
      if (lastResult.speed < 1) {
        lastResult.panelData.stateLabel = 'still';
      }
      // 面板更新节流：每 100ms 更新一次 DOM
      if (now - lastPanelUpdateTime >= 100) {
        panelRenderer.updateInfo(lastResult.panelData);
        lastPanelUpdateTime = now;
      }
    }

    // 引导效果：星空视差（静止时归零，实时响应）
    if (lastResult && !isStill) {
      const theta = lastResult.prediction.vx !== 0 || lastResult.prediction.vy !== 0
        ? Math.atan2(lastResult.prediction.vy, lastResult.prediction.vx)
        : 0;
      setStarryParallax(theta, lastResult.confidence);
    } else {
      setStarryParallax(0, 0);
    }

    // ── 倾向引擎 + 双向导航 ──
    // 限制 dt 防止后台标签返回时倾向值突跳
    const dt = Math.min(0.1, (now - lastTendencyTime) / 1000);
    lastTendencyTime = now;

    if (lastResult && isHome) {
      const targetAngle = ENTRY_CONFIGS[0].angle;

      if (isStill) {
        // 静止：立即归零，不经过慢速 decay
        tendencyEngine.reset();
        setStarryTendency(0, 0);
      } else {
        const predictedTheta = lastResult.prediction.vx !== 0 || lastResult.prediction.vy !== 0
          ? Math.atan2(lastResult.prediction.vy, lastResult.prediction.vx)
          : 0;

        const tendency = tendencyEngine.update(dt, predictedTheta, targetAngle);
        setStarryTendency(tendencyEngine.direction, tendency);

        // 自动切换
        if (tendency >= TENDENCY_THRESHOLD) {
          viewSwitcher.switchTo('algo-test');
        }
      }

      setPortals(computePortalData());
    }

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