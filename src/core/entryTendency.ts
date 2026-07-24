/**
 * 多入口倾向计算器
 * 为每个入口独立计算 EMA 平滑倾向值，支持锁定机制防止快速切换
 */

import { EntryRenderData } from '../renderer/entryRenderer';

const LOCK_DURATION_MS = 500;
const EMA_DECAY = 0.85;
const EMA_ALPHA = 0.15;
const MIN_TENDENCY = 0.01;

export interface EntryTendencyConfig {
  id: string;
  theta: number;
  phi: number;
  label: string;
}

export class EntryTendency {
  private readonly configs: EntryTendencyConfig[];
  private tendencies: number[];
  private lockedEntryId: string | null = null;
  private lockEndTime = 0;

  constructor(configs: EntryTendencyConfig[]) {
    this.configs = configs;
    this.tendencies = new Array(configs.length).fill(0);
  }

  update(predictedTheta: number, now: number): void {
    for (let i = 0; i < this.configs.length; i++) {
      const mappedTheta = predictedTheta + Math.PI / 2;
      const alignment = Math.max(0, Math.cos(mappedTheta - this.configs[i].theta));
      this.tendencies[i] = this.tendencies[i] * EMA_DECAY + alignment * EMA_ALPHA;
      if (this.tendencies[i] < MIN_TENDENCY) this.tendencies[i] = 0;
    }

    let maxTendency = 0;
    let maxIndex = -1;
    for (let i = 0; i < this.tendencies.length; i++) {
      if (this.tendencies[i] > maxTendency) {
        maxTendency = this.tendencies[i];
        maxIndex = i;
      }
    }
    if (maxIndex >= 0 && maxTendency > 0) {
      const newLockId = this.configs[maxIndex].id;
      if (this.lockedEntryId !== newLockId) {
        // 切换锁定目标
        this.lockedEntryId = newLockId;
        this.lockEndTime = now + LOCK_DURATION_MS;
      } else {
        // 同一入口持续领先时续期，避免短暂静止导致锁过期后目标角跳变
        this.lockEndTime = now + LOCK_DURATION_MS;
      }
    }
  }

  tickLock(now: number): void {
    if (this.lockedEntryId && now >= this.lockEndTime) {
      this.lockedEntryId = null;
    }
  }

  getRenderData(): EntryRenderData[] {
    // L10：空 configs 时显式返回空数组，避免隐式约定
    if (this.configs.length === 0) return [];
    return this.configs.map((entry, i) => ({
      id: entry.id,
      label: entry.label,
      theta: entry.theta,
      phi: entry.phi,
      tendency: this.tendencies[i],
    }));
  }

  getLockedEntryId(): string | null {
    return this.lockedEntryId;
  }

  reset(): void {
    this.tendencies.fill(0);
    this.lockedEntryId = null;
    this.lockEndTime = 0;
  }
}
