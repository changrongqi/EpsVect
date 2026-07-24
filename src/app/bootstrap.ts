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
import { ViewSwitcher } from '../ui/viewSwitcher';
import { TendencyEngine } from '../core/tendency';
import { AppScheduler } from '../core/appScheduler';
import { TendencyController } from '../core/tendencyController';
import { MouseHandler } from '../core/mouseHandler';
import { ActionTendencyController } from '../core/actionTendencyController';
import { ActionConfig } from '../core/actionTendency';
import { initRenderer, setMaxTrailLength, setViewMode, setEntries, clearTrailData } from '../renderer/canvas';
import { initStarryBackground, setStarryParallax, setStarryTendency, setStarryHomeMode } from '../renderer/starry';
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
  viewSwitcher.register('home', document.getElementById('home-view')!);
  viewSwitcher.register('algo-test', document.getElementById('algo-test-view')!);
  viewSwitcher.register('about', document.getElementById('about-view')!);
  viewSwitcher.register('settings', document.getElementById('settings-view')!);
  viewSwitcher.register('source-code', document.getElementById('source-code-view')!);
  viewSwitcher.register('math-derivation', document.getElementById('math-derivation-view')!);
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
      noiseValueEl: document.getElementById('noise-value')!,
      mincutoffSlider: refs.mincutoffSlider,
      mincutoffValueEl: document.getElementById('mincutoff-value')!,
      betaSlider: refs.betaSlider,
      betaValueEl: document.getElementById('beta-value')!,
      trailSlider: refs.trailSlider,
      trailValueEl: document.getElementById('trail-value')!,
      blendSlider: refs.blendSlider,
      blendValueEl: document.getElementById('blend-value')!,
      qSlider: refs.qSlider,
      qValueEl: document.getElementById('q-value')!,
      rSlider: refs.rSlider,
      rValueEl: document.getElementById('r-value')!,
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
      // settings 滑块值是 0-100，DataProcessor 期望 0-1
      dataProcessor.updateBlendRatio(value / 100);
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
  cursorManager.setVisibleForView(viewSwitcher.getCurrentView());
  viewSwitcher.onSwitch((view) => {
    cursorManager.setVisibleForView(view);
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
  if (aboutContentEl) {
    new NarrativeRenderer().render(aboutContentEl, ABOUT_SECTIONS);
  }

  const sourceCodeContentEl = document.getElementById('source-code-content');
  if (sourceCodeContentEl) {
    new NarrativeRenderer().render(sourceCodeContentEl, SOURCE_CODE_SECTIONS);
  }

  const mathContentEl = document.getElementById('math-derivation-content');
  if (mathContentEl) {
    new NarrativeRenderer().render(mathContentEl, MATH_SECTIONS);
  }

  const settingsContentEl = document.getElementById('settings-content');
  if (settingsContentEl) {
    const settingsRenderer = new SettingsRenderer({
      onParamChange: (key, value) => {
        applyParamChange(core.dataProcessor, key, value);
        syncAlgoTestSlider(key, value);
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
        settingsRenderer.setAllParamValues(preset.values);
        syncAllAlgoTestSliders(preset.values);
      },
    });
    settingsRenderer.render(settingsContentEl, SETTINGS_GROUPS, SETTINGS_PRESETS);
  }

  let lastResult: PipelineResult | null = null;
  const fpsTargetRef: { current: MouseHandler | null } = { current: null };

  const scheduler = new AppScheduler({
    driftDetector: core.driftDetector,
    statsCollector: core.statsCollector,
    qualityAnalyzer: core.qualityAnalyzer,
    historyRecorder: core.historyRecorder,
    panelRenderer: ui.panelRenderer,
    dataProcessor: core.dataProcessor,
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

  const onMouseMove = bindGlobalEvents({
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
  };
}
