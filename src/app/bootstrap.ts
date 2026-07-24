import { DataProcessor } from '../processor/dataProcessor';
import { DirectionDetector } from '../detector/directionDetector';
import { ConfidenceCalculator } from '../detector/confidenceCalculator';
import { DriftDetector } from '../detector/driftDetector';
import { StatsCollector } from '../debug/statsCollector';
import { HistoryRecorder } from '../debug/historyRecorder';
import { QualityAnalyzer } from '../debug/qualityAnalyzer';
import { SliderController } from '../ui/sliderController';
import { FreezeController } from '../ui/freezeController';
import { PanelRenderer } from '../ui/panelRenderer';
import { MousePipeline } from '../core/pipeline';
import { ViewSwitcher, type ViewName } from '../ui/viewSwitcher';
import { TendencyEngine } from '../core/tendency';
import { AppScheduler } from '../core/appScheduler';
import { TendencyController } from '../core/tendencyController';
import { MouseHandler } from '../core/mouseHandler';
import { ActionTendencyController } from '../core/actionTendencyController';
import { ActionConfig } from '../core/actionTendency';
import { initRenderer, setMaxTrailLength, setViewMode, setEntries, clearTrailData, destroyRenderer } from '../renderer/canvas';
import { initStarryBackground, setStarryParallax, setStarryTendency, setStarryHomeMode, destroyStarryBackground } from '../renderer/starry';
import { ENTRY_CONFIGS } from '../config/entryConfig';
import { HOME_PROFILE } from '../config/profileConfig';
import { ABOUT_SECTIONS } from '../config/aboutContent';
import { SOURCE_CODE_SECTIONS } from '../config/sourceCodeContent';
import { MATH_SECTIONS } from '../config/mathDerivationContent';
import { SETTINGS_GROUPS, SETTINGS_PRESETS } from '../config/settingsContent';
import { NarrativeRenderer } from '../ui/narrativeRenderer';
import { SettingsRenderer } from '../ui/settingsRenderer';
import { CursorManager } from '../ui/cursorManager';
import type { ParamKey } from '../config/settingsContent';
import { DomRefs, getSliderValues } from './domRefs';
import { getElementByIdOrThrow } from './domUtils';
import { bindGlobalEvents } from './eventBindings';
import type { AppContext } from './appContext';
import type { PipelineResult } from '../core/pipeline';

function createCoreProcessors(refs: DomRefs) {
  const values = getSliderValues(refs);

  const dataProcessor = new DataProcessor({
    noiseStdDev: values.noiseStdDev,
    mincutoff: values.mincutoff,
    beta: values.beta,
    kalmanQ: values.kalmanQ,
    kalmanR: values.kalmanR,
    blendRatio: values.blendRatio,
  });

  const directionDetector = new DirectionDetector();
  const confidenceCalculator = new ConfidenceCalculator();
  const driftDetector = new DriftDetector();
  const statsCollector = new StatsCollector(1000);
  const historyRecorder = new HistoryRecorder(600);
  const qualityAnalyzer = new QualityAnalyzer();

  const pipeline = new MousePipeline(
    dataProcessor,
    directionDetector,
    confidenceCalculator,
    driftDetector,
    statsCollector,
  );

  const tendencyEngine = new TendencyEngine();

  return {
    dataProcessor,
    directionDetector,
    confidenceCalculator,
    driftDetector,
    statsCollector,
    historyRecorder,
    qualityAnalyzer,
    pipeline,
    tendencyEngine,
  };
}

function createViewSwitcher(): ViewSwitcher {
  const viewSwitcher = new ViewSwitcher();
  viewSwitcher.register('home', getElementByIdOrThrow('home-view'));
  viewSwitcher.register('algo-test', getElementByIdOrThrow('algo-test-view'));
  viewSwitcher.register('about', getElementByIdOrThrow('about-view'));
  viewSwitcher.register('settings', getElementByIdOrThrow('settings-view'));
  viewSwitcher.register('source-code', getElementByIdOrThrow('source-code-view'));
  viewSwitcher.register('math-derivation', getElementByIdOrThrow('math-derivation-view'));
  return viewSwitcher;
}

function createUIControllers(
  refs: DomRefs,
  dataProcessor: DataProcessor,
  historyRecorder: HistoryRecorder,
) {
  const sliderController = new SliderController(
    {
      noiseSlider: refs.noiseSlider,
      noiseValueEl: getElementByIdOrThrow('noise-value'),
      mincutoffSlider: refs.mincutoffSlider,
      mincutoffValueEl: getElementByIdOrThrow('mincutoff-value'),
      betaSlider: refs.betaSlider,
      betaValueEl: getElementByIdOrThrow('beta-value'),
      trailSlider: refs.trailSlider,
      trailValueEl: getElementByIdOrThrow('trail-value'),
      blendSlider: refs.blendSlider,
      blendValueEl: getElementByIdOrThrow('blend-value'),
      qSlider: refs.qSlider,
      qValueEl: getElementByIdOrThrow('q-value'),
      rSlider: refs.rSlider,
      rValueEl: getElementByIdOrThrow('r-value'),
    },
    {
      onNoiseChange: (value) => { dataProcessor.updateNoise(value); },
      onMincutoffChange: (value) => dataProcessor.updateMincutoff(value),
      onBetaChange: (value) => dataProcessor.updateBeta(value),
      onTrailLengthChange: (value) => setMaxTrailLength(value),
      onBlendChange: (value) => dataProcessor.updateBlendRatio(value),
      onQChange: (value) => dataProcessor.updateKalmanQ(value),
      onRChange: (value) => dataProcessor.updateKalmanR(value),
    },
  );

  const values = getSliderValues(refs);
  sliderController.setInitialValues({
    noise: values.noiseStdDev,
    mincutoff: values.mincutoff,
    beta: values.beta,
    trailLength: values.trailLength,
    blend: parseInt(refs.blendSlider.value, 10),
    q: values.kalmanQ,
    r: values.kalmanR,
  });

  const freezeController = new FreezeController({
    infoPanel: getElementByIdOrThrow('info-panel'),
    freezeIndicatorEl: getElementByIdOrThrow('freeze-indicator'),
  });

  const panelRenderer = new PanelRenderer(
    {
      rawCoordsEl: getElementByIdOrThrow('raw-coords'),
      smoothCoordsEl: getElementByIdOrThrow('smooth-coords'),
      predCoordsEl: getElementByIdOrThrow('pred-coords'),
      speedDisplayEl: getElementByIdOrThrow('speed-display'),
      kalmanVelEl: getElementByIdOrThrow('kalman-vel'),
      thetaDisplayEl: getElementByIdOrThrow('theta-display'),
      confidenceDisplayEl: getElementByIdOrThrow('confidence-display'),
      thetaLagEl: getElementByIdOrThrow('theta-lag'),
      stateDisplayEl: getElementByIdOrThrow('state-display'),
      driftDisplayEl: getElementByIdOrThrow('drift-display'),
      trailLengthEl: getElementByIdOrThrow('trail-length'),
      fpsDisplayEl: getElementByIdOrThrow('fps-display'),
    },
    { historyRecorder },
  );

  return { sliderController, freezeController, panelRenderer };
}

function setupViewSwitcherCallbacks(
  viewSwitcher: ViewSwitcher,
  dataProcessor: DataProcessor,
  tendencyEngine: TendencyEngine,
  tendencyControllerRef: { current: TendencyController | null },
  actionTendencyController: ActionTendencyController,
  refs: DomRefs,
) {
  viewSwitcher.onSwitch((view) => {
    clearTrailData();

    const isAlgoTest = view === 'algo-test';
    setStarryHomeMode(!isAlgoTest);
    tendencyEngine.reset();
    tendencyControllerRef.current?.reset();

    if (view === 'home') {
      setViewMode('home');
      actionTendencyController.unregisterView();
    } else if (view === 'algo-test') {
      setViewMode('algo-test');
      dataProcessor.applyProfile({
        noiseStdDev: parseFloat(refs.noiseSlider.value),
        mincutoff: parseFloat(refs.mincutoffSlider.value),
        beta: parseFloat(refs.betaSlider.value),
        blendRatio: parseInt(refs.blendSlider.value, 10) / 100,
        kalmanQ: parseInt(refs.qSlider.value, 10),
        kalmanR: parseInt(refs.rSlider.value, 10),
      });
      const algoActions = collectActionsFromDOM('algo-test');
      actionTendencyController.registerView('algo-test', algoActions);
    } else {
      setViewMode('sub');
      dataProcessor.applyProfile(HOME_PROFILE);
      const subActions = collectActionsFromDOM(view);
      actionTendencyController.registerView(view, subActions);
    }
  });
}

function collectActionsFromDOM(viewId: string): ActionConfig[] {
  const actions: ActionConfig[] = [];
  const viewEl = document.getElementById(`${viewId}-view`);
  if (!viewEl) return actions;

  viewEl.querySelectorAll<HTMLElement>('[data-action-id]').forEach((el) => {
    const id = el.dataset.actionId;
    if (id) {
      const rect = el.getBoundingClientRect();
      actions.push({
        id,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }
  });
  return actions;
}

/** 将参数变更分发到 DataProcessor 的对应方法 */
function applyParamChange(dataProcessor: DataProcessor, key: ParamKey, value: number): void {
  switch (key) {
    case 'noise':
      dataProcessor.updateNoise(value);
      break;
    case 'mincutoff':
      dataProcessor.updateMincutoff(value);
      break;
    case 'beta':
      dataProcessor.updateBeta(value);
      break;
    case 'q':
      dataProcessor.updateKalmanQ(value);
      break;
    case 'r':
      dataProcessor.updateKalmanR(value);
      break;
    case 'blend':
      // L26：value 已在 settingsRenderer 的 binding.transform 中转换为 0-1，
      // 不再在此处 /100；algo-test 视图的 sliderController 自身有 transform，
      // 两条滑块路径的单位转换都在各自 binding 层完成，避免重复定义
      dataProcessor.updateBlendRatio(value);
      break;
    case 'trail':
      setMaxTrailLength(value);
      break;
  }
}

/** algo-test 滑块的 DOM id 映射 */
const ALGO_TEST_SLIDER_IDS: Record<ParamKey, { slider: string; value: string; format: (v: number) => string }> = {
  noise: { slider: 'noise-slider', value: 'noise-value', format: (v) => v.toFixed(1) },
  mincutoff: { slider: 'mincutoff-slider', value: 'mincutoff-value', format: (v) => v.toFixed(1) },
  beta: { slider: 'beta-slider', value: 'beta-value', format: (v) => v.toFixed(3) },
  trail: { slider: 'trail-slider', value: 'trail-value', format: (v) => String(v) },
  blend: { slider: 'blend-slider', value: 'blend-value', format: (v) => String(v) },
  q: { slider: 'q-slider', value: 'q-value', format: (v) => String(v) },
  r: { slider: 'r-slider', value: 'r-value', format: (v) => String(v) },
};

/** 同步单个参数到 algo-test 的 control-panel 滑块（不触发 input 事件） */
function syncAlgoTestSlider(key: ParamKey, value: number): void {
  const ids = ALGO_TEST_SLIDER_IDS[key];
  if (!ids) return;
  const slider = document.getElementById(ids.slider) as HTMLInputElement | null;
  const valueEl = document.getElementById(ids.value);
  if (!slider || !valueEl) return;
  slider.value = String(value);
  valueEl.textContent = ids.format(value);
}

/** 批量同步所有参数到 algo-test 滑块 */
function syncAllAlgoTestSliders(values: Record<ParamKey, number>): void {
  (Object.keys(values) as ParamKey[]).forEach((key) => {
    syncAlgoTestSlider(key, values[key]);
  });
}

export function bootstrapApp(
  refs: DomRefs,
): AppContext & { onMouseMove: (e: MouseEvent) => void } {
  initRenderer('#trail-canvas', getSliderValues(refs).trailLength);
  initStarryBackground('#starry-canvas');

  const core = createCoreProcessors(refs);
  const viewSwitcher = createViewSwitcher();
  const ui = createUIControllers(refs, core.dataProcessor, core.historyRecorder);

  const actionTendencyController = new ActionTendencyController();

  const cursorManager = new CursorManager();
  // L14：setVisibleForView 重命名为 resetState（参数未使用）
  cursorManager.resetState();
  // L27：本文件注册了 3 个 onSwitch 回调，顺序约束如下（依赖 viewSwitcher.onSwitch 按 push 顺序触发）：
  //   1. 此处：cursorManager.resetState() —— 清理拖动状态，必须在 view 切换逻辑前/后均可，放最前
  //   2. setupViewSwitcherCallbacks：清 trail / setStarryHomeMode / reset tendency / applyProfile / register view
  //   3. 末尾 setActive：按视图启停渲染器 RAF，必须在 view 切换后
  // 新增 onSwitch 回调时请评估与上述顺序的依赖关系
  viewSwitcher.onSwitch(() => {
    cursorManager.resetState();
  });

  const tendencyControllerRef: { current: TendencyController | null } = { current: null };

  const tendencyController = new TendencyController({
    tendencyEngine: core.tendencyEngine,
    viewSwitcher,
    entryConfigs: ENTRY_CONFIGS,
    onEntriesUpdate: setEntries,
    onStarryTendency: setStarryTendency,
    actionTendencyController,
  });
  tendencyControllerRef.current = tendencyController;

  setupViewSwitcherCallbacks(viewSwitcher, core.dataProcessor, core.tendencyEngine, tendencyControllerRef, actionTendencyController, refs);

  setViewMode('home');
  setStarryHomeMode(true);
  core.dataProcessor.applyProfile(HOME_PROFILE);

  const aboutContentEl = document.getElementById('about-content');
  const sourceCodeContentEl = document.getElementById('source-code-content');
  const mathContentEl = document.getElementById('math-derivation-content');
  const settingsContentEl = document.getElementById('settings-content');

  // 保存所有渲染器实例引用，以便 HMR/卸载时销毁（避免 RAF 与监听器泄漏）
  // 同时记录视图名，用于 onSwitch 时按视图启停 RAF
  const renderers: Array<{ destroy: () => void; setActive: (active: boolean) => void; viewName: ViewName }> = [];

  if (aboutContentEl) {
    const r = new NarrativeRenderer();
    r.render(aboutContentEl, ABOUT_SECTIONS);
    renderers.push({ destroy: () => r.destroy(), setActive: (a) => r.setActive(a), viewName: 'about' });
  }
  if (sourceCodeContentEl) {
    const r = new NarrativeRenderer();
    r.render(sourceCodeContentEl, SOURCE_CODE_SECTIONS);
    renderers.push({ destroy: () => r.destroy(), setActive: (a) => r.setActive(a), viewName: 'source-code' });
  }
  if (mathContentEl) {
    const r = new NarrativeRenderer();
    r.render(mathContentEl, MATH_SECTIONS);
    renderers.push({ destroy: () => r.destroy(), setActive: (a) => r.setActive(a), viewName: 'math-derivation' });
  }

  let settingsRenderer: SettingsRenderer | null = null;
  if (settingsContentEl) {
    settingsRenderer = new SettingsRenderer({
      onParamChange: (key, value, rawValue) => {
        // L26：value 已 transform（blend 是 0-1），rawValue 是原始滑块值（blend 是 0-100）
        applyParamChange(core.dataProcessor, key, value);
        syncAlgoTestSlider(key, rawValue);
      },
      onPresetApply: (presetId) => {
        const preset = SETTINGS_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        core.dataProcessor.applyProfile({
          noiseStdDev: preset.values.noise,
          mincutoff: preset.values.mincutoff,
          beta: preset.values.beta,
          blendRatio: preset.values.blend / 100,
          kalmanQ: preset.values.q,
          kalmanR: preset.values.r,
        });
        setMaxTrailLength(preset.values.trail);
        settingsRenderer?.setAllParamValues(preset.values);
        syncAllAlgoTestSliders(preset.values);
      },
    });
    settingsRenderer.render(settingsContentEl, SETTINGS_GROUPS, SETTINGS_PRESETS);
    renderers.push({ destroy: () => settingsRenderer!.destroy(), setActive: (a) => settingsRenderer!.setActive(a), viewName: 'settings' });
  }

  // 视图切换时启停对应渲染器的 RAF，避免隐藏视图的无意义计算
  viewSwitcher.onSwitch((view) => {
    for (const r of renderers) {
      r.setActive(r.viewName === view);
    }
  });

  let lastResult: PipelineResult | null = null;
  const fpsTargetRef: { current: MouseHandler | null } = { current: null };

  const scheduler = new AppScheduler({
    driftDetector: core.driftDetector,
    statsCollector: core.statsCollector,
    qualityAnalyzer: core.qualityAnalyzer,
    historyRecorder: core.historyRecorder,
    panelRenderer: ui.panelRenderer,
    onStarryParallax: setStarryParallax,
    isHomeMode: () => viewSwitcher.getCurrentView() === 'home',
    onExtraUpdate: (isHome, isStill, now) => {
      tendencyController.update(lastResult, isHome, isStill, now);
    },
    onFpsUpdate: (fps) => {
      fpsTargetRef.current?.setCurrentFps(fps);
    },
  });

  const mouseHandler = new MouseHandler({
    pipeline: core.pipeline,
    panelRenderer: ui.panelRenderer,
    historyRecorder: core.historyRecorder,
    onResult: (result) => {
      lastResult = result;
      scheduler.setLastResult(result);
    },
  });
  fpsTargetRef.current = mouseHandler;

  const { onMouseMove, cleanup: unbindGlobalEvents } = bindGlobalEvents({
    viewSwitcher,
    freezeController: ui.freezeController,
    panelRenderer: ui.panelRenderer,
    tendencyController,
    scheduler,
    mouseHandler,
    actionTendencyController,
    cursorManager,
  });

  scheduler.start();

  // resize 时刷新当前视图的 action 坐标（防抖 200ms），
  // 否则窗口大小变化后倾向计算仍用旧坐标导致高亮错位
  let resizeTimer = 0;
  const onResize = () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const currentView = viewSwitcher.getCurrentView();
      if (currentView !== 'home') {
        const actions = collectActionsFromDOM(currentView);
        if (actions.length > 0) {
          actionTendencyController.registerView(currentView, actions);
        }
      }
      resizeTimer = 0;
    }, 200);
  };
  window.addEventListener('resize', onResize);

  /** 销毁所有渲染器、调度器、光标管理器，释放 RAF 与监听器（HMR/卸载时调用） */
  const destroy = () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    for (const r of renderers) {
      r.destroy();
    }
    renderers.length = 0;
    unbindGlobalEvents();
    scheduler.stop();
    cursorManager.destroy();
    actionTendencyController.unregisterView();
    destroyStarryBackground();
    destroyRenderer();
    // 清理滑块与面板监听器（HMR 重载时防止监听器累积）
    ui.sliderController.destroy();
    ui.panelRenderer.destroy();
    // L16：清理 viewSwitcher 回调数组，防止 HMR 重载时 onSwitch 回调累积
    viewSwitcher.destroy();
  };

  return {
    dataProcessor: core.dataProcessor,
    directionDetector: core.directionDetector,
    confidenceCalculator: core.confidenceCalculator,
    driftDetector: core.driftDetector,
    statsCollector: core.statsCollector,
    historyRecorder: core.historyRecorder,
    qualityAnalyzer: core.qualityAnalyzer,
    pipeline: core.pipeline,
    tendencyEngine: core.tendencyEngine,
    viewSwitcher,
    tendencyController,
    mouseHandler,
    scheduler,
    sliderController: ui.sliderController,
    freezeController: ui.freezeController,
    panelRenderer: ui.panelRenderer,
    onMouseMove,
    destroy,
  };
}
