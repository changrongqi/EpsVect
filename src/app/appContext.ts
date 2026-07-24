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

export interface AppContext {
  dataProcessor: DataProcessor;
  directionDetector: DirectionDetector;
  confidenceCalculator: ConfidenceCalculator;
  driftDetector: DriftDetector;
  statsCollector: StatsCollector;
  historyRecorder: HistoryRecorder;
  qualityAnalyzer: QualityAnalyzer;
  pipeline: MousePipeline;
  tendencyEngine: TendencyEngine;
  viewSwitcher: ViewSwitcher;
  tendencyController: TendencyController;
  mouseHandler: MouseHandler;
  scheduler: AppScheduler;
  sliderController: SliderController;
  freezeController: FreezeController;
  panelRenderer: PanelRenderer;
}
