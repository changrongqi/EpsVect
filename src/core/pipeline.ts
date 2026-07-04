/**
 * 鼠标管线处理器
 * 封装鼠标事件的数据处理管线：滤波 → 方向检测 → 置信度 → 漂移 → 统计
 * 对外暴露单一 process() 方法，返回统一的 PipelineResult
 */

import { DataProcessor, ProcessedData } from '../processor/dataProcessor';
import { DirectionDetector, DirectionResult } from '../detector/directionDetector';
import { ConfidenceCalculator } from '../detector/confidenceCalculator';
import { DriftDetector } from '../detector/driftDetector';
import { StatsCollector } from '../debug/statsCollector';
import { PanelUpdateData } from '../ui/panelRenderer';
import { HistoryEntry } from '../debug/historyRecorder';

export interface PipelineResult {
  /** 噪声坐标（用于拖尾原始点） */
  noisy: { x: number; y: number };
  /** 平滑坐标（用于拖尾平滑点） */
  smooth: { x: number; y: number };
  /** 预测箭头渲染数据 */
  prediction: {
    fromX: number;
    fromY: number;
    vx: number;
    vy: number;
    predX: number;
    predY: number;
    confidence: number;
    speed: number;
  };
  /** 信息面板更新数据 */
  panelData: PanelUpdateData;
  /** 当前速度（px/s） */
  speed: number;
  /** 方向延迟（度） */
  lagDeg: number;
  /** 当前置信度 */
  confidence: number;
  /** 预测误差 */
  predError: number;
  /** 历史记录条目 */
  historyEntry: Omit<HistoryEntry, 'timestamp'>;
}

export class MousePipeline {
  constructor(
    private dataProcessor: DataProcessor,
    private directionDetector: DirectionDetector,
    private confidenceCalculator: ConfidenceCalculator,
    private driftDetector: DriftDetector,
    private statsCollector: StatsCollector,
  ) {}

  process(e: MouseEvent, fps: number): PipelineResult {
    const processed = this.dataProcessor.process(e);

    this.directionDetector.pushMicroWindow(processed.smoothX, processed.smoothY);
    const dirResult = this.directionDetector.detect(processed.speed, processed.dx, processed.dy);

    if (processed.speed >= 5) {
      this.confidenceCalculator.pushTheta(dirResult.theta);
    } else {
      this.confidenceCalculator.clearHistory();
    }
    const confidence = this.confidenceCalculator.compute(processed.speed);

    if (processed.speed < 5) {
      this.driftDetector.push(processed.smoothX, processed.smoothY);
    } else {
      this.driftDetector.clear();
    }

    const kalmanVel = this.dataProcessor.getKalmanVelocity();

    const predError = this.statsCollector.record(
      processed.speed,
      dirResult.lagDeg,
      confidence,
      fps,
      processed.smoothX,
      processed.smoothY,
      processed.predX,
      processed.predY,
    );

    return {
      noisy: { x: processed.noisyX, y: processed.noisyY },
      smooth: { x: processed.smoothX, y: processed.smoothY },
      prediction: {
        fromX: processed.smoothX,
        fromY: processed.smoothY,
        vx: processed.vx,
        vy: processed.vy,
        predX: processed.predX,
        predY: processed.predY,
        confidence,
        speed: processed.speed,
      },
      panelData: {
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
      },
      speed: processed.speed,
      lagDeg: dirResult.lagDeg,
      confidence,
      predError,
      historyEntry: {
        rawX: processed.noisyX,
        rawY: processed.noisyY,
        smoothX: processed.smoothX,
        smoothY: processed.smoothY,
        predX: processed.predX,
        predY: processed.predY,
        vx: processed.vx,
        vy: processed.vy,
        speed: processed.speed,
        theta: dirResult.theta,
        smoothedTheta: dirResult.smoothedTheta,
        confidence,
        state: dirResult.stateLabel,
        predError,
      },
    };
  }
}