/**
 * 倾向控制器
 * 协调入口倾向计算、星空倾向同步和子界面返回检测
 */

import { TendencyEngine } from './tendency';
import { PipelineResult } from './pipeline';
// L47/noUnusedLocals: ViewName 类型未在本文使用，仅保留 ViewSwitcher
import { ViewSwitcher } from '../ui/viewSwitcher';
import { EntryTendency, EntryTendencyConfig } from './entryTendency';
import { EntryRenderData } from '../renderer/entryRenderer';
import { ActionTendencyController } from './actionTendencyController';

interface TendencyControllerOptions {
  tendencyEngine: TendencyEngine;
  viewSwitcher: ViewSwitcher;
  entryConfigs: EntryTendencyConfig[];
  onEntriesUpdate: (entries: EntryRenderData[]) => void;
  onStarryTendency: (direction: number, strength: number) => void;
  actionTendencyController?: ActionTendencyController;
}

export class TendencyController {
  private readonly tendencyEngine: TendencyEngine;
  private readonly viewSwitcher: ViewSwitcher;
  private readonly entryConfigs: EntryTendencyConfig[];
  private readonly onEntriesUpdate: (entries: EntryRenderData[]) => void;
  private readonly onStarryTendency: (direction: number, strength: number) => void;
  private readonly entryTendency: EntryTendency;
  private readonly actionTendencyController?: ActionTendencyController;
  private lastTendencyTime = performance.now();

  constructor(options: TendencyControllerOptions) {
    this.tendencyEngine = options.tendencyEngine;
    this.viewSwitcher = options.viewSwitcher;
    this.entryConfigs = options.entryConfigs;
    this.onEntriesUpdate = options.onEntriesUpdate;
    this.onStarryTendency = options.onStarryTendency;
    this.entryTendency = new EntryTendency(options.entryConfigs);
    this.actionTendencyController = options.actionTendencyController;
  }

  update(lastResult: PipelineResult | null, isHome: boolean, isStill: boolean, now: number): void {
    if (!lastResult) return;

    // dt 双向钳制：上界 0.1s 防止后台标签页回来时大跳变，
    // 下界 0 防止时钟回拨导致负 dt（负 dt 会让 tendency 对齐/衰减逻辑反转）
    const dt = Math.max(0, Math.min(0.1, (now - this.lastTendencyTime) / 1000));
    this.lastTendencyTime = now;

    const predictedTheta = lastResult.prediction.vx !== 0 || lastResult.prediction.vy !== 0
      ? Math.atan2(lastResult.prediction.vy, lastResult.prediction.vx)
      : 0;

    if (isHome) {
      this.updateHomeMode(predictedTheta, isStill, now, dt);
    } else {
      this.updateSubMode(predictedTheta, isStill, dt, lastResult);
    }
  }

  private updateHomeMode(predictedTheta: number, isStill: boolean, now: number, dt: number): void {
    if (isStill) {
      this.entryTendency.tickLock(now);
    } else {
      this.entryTendency.update(predictedTheta, now);
      this.updateStarryTendency(dt, predictedTheta);
    }
    this.onEntriesUpdate(this.entryTendency.getRenderData());
  }

  private getActiveTargetAngle(): number {
    const lockedId = this.entryTendency.getLockedEntryId();
    if (lockedId) {
      const config = this.entryConfigs.find((c) => c.id === lockedId);
      if (config) return config.theta;
    }
    // 空数组保护：避免 entryConfigs[0] 为 undefined 导致后续 NaN 传播
    if (this.entryConfigs.length === 0) return 0;
    return this.entryConfigs[0].theta;
  }

  private updateSubMode(predictedTheta: number, isStill: boolean, _dt: number, _lastResult: PipelineResult): void {
    if (!this.actionTendencyController) return;

    if (isStill) return;

    const currentView = this.viewSwitcher.getCurrentView();
    if (currentView !== 'home') {
      this.actionTendencyController.update(predictedTheta);
    }
  }

  private updateStarryTendency(dt: number, predictedTheta: number): void {
    const targetAngle = this.getActiveTargetAngle();
    this.tendencyEngine.update(dt, predictedTheta, targetAngle);
    this.onStarryTendency(this.tendencyEngine.direction, this.tendencyEngine.tendency);
  }

  reset(): void {
    this.entryTendency.reset();
    this.tendencyEngine.reset();
    // 重置 lastTendencyTime，否则 reset 后首帧 dt 会被钳到上限 0.1s，
    // 导致 tendency 以最大 dt 推进产生跳变
    this.lastTendencyTime = performance.now();
  }
}
