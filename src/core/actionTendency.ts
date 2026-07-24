export interface ActionConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ActionRenderData {
  id: string;
  tendency: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const EMA_DECAY = 0.85;
const EMA_ALPHA = 0.15;
const MIN_TENDENCY = 0.01;
const HIGHLIGHT_THRESHOLD = 0.15;
const HIGHLIGHT_RELEASE_THRESHOLD = 0.06;

/**
 * 动作倾向计算器
 *
 * 设计要点：
 * - tendency 按 id 存储（Map），而非按数组索引。这样 configs 顺序变化或
 *   数量变化（如 refreshActionRects 从 DOM 重新采集）都不会导致 tendency
 *   漂移到错误的 action 上。
 * - updateActionRects 仅更新 configs 的几何位置，保留所有已积累的 tendency。
 * - 新出现的 id 自动初始化为 0；消失的 id 在下次 reset 时清理。
 */
export class ActionTendency {
  private configs: ActionConfig[];
  // 按 id 存储 tendency，彻底消除顺序依赖与长度不同步问题
  private tendencies: Map<string, number> = new Map();
  // L4：删除 lastUpdateTime（写入但从不读取，死字段）
  private maxDistance: number;

  constructor(configs: ActionConfig[]) {
    this.configs = configs;
    for (const c of configs) {
      this.tendencies.set(c.id, 0);
    }
    this.maxDistance = this.computeMaxDistance();
  }

  private computeMaxDistance(): number {
    return Math.sqrt(
      (window.innerWidth / 2) ** 2 + (window.innerHeight / 2) ** 2,
    );
  }

  /**
   * 更新 action 的几何位置（如 resize 后或 DOM 重新采集）。
   * 仅替换 configs，tendency 值按 id 保留，新增 id 初始化为 0。
   */
  updateActionRects(configs: ActionConfig[]): void {
    this.configs = configs;
    // 为新出现的 id 初始化 tendency 为 0；已存在的 id 保留原值
    for (const c of configs) {
      if (!this.tendencies.has(c.id)) {
        this.tendencies.set(c.id, 0);
      }
    }
    this.maxDistance = this.computeMaxDistance();
  }

  update(predictedTheta: number): void {
    // L4：删除 lastUpdateTime 赋值（死字段）

    for (const action of this.configs) {
      const cx = action.x + action.width / 2;
      const cy = action.y + action.height / 2;

      const dx = cx - window.innerWidth / 2;
      const dy = cy - window.innerHeight / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const targetTheta = Math.atan2(dy, dx);
      const alignment = Math.max(0, Math.cos(predictedTheta - targetTheta));

      const distanceFactor = Math.max(0.3, 1 - dist / this.maxDistance);
      const weightedAlignment = alignment * distanceFactor;

      const prev = this.tendencies.get(action.id) ?? 0;
      let next = prev * EMA_DECAY + weightedAlignment * EMA_ALPHA;
      if (next < MIN_TENDENCY) next = 0;
      if (next > 1) next = 1;
      this.tendencies.set(action.id, next);
    }
  }

  getRenderData(): ActionRenderData[] {
    return this.configs.map((action) => ({
      id: action.id,
      tendency: this.tendencies.get(action.id) ?? 0,
      x: action.x,
      y: action.y,
      width: action.width,
      height: action.height,
    }));
  }

  getHighestTendencyAction(currentHighlightId?: string | null): string | null {
    let maxTendency = 0;
    let maxId: string | null = null;
    for (const action of this.configs) {
      const t = this.tendencies.get(action.id) ?? 0;
      if (t > maxTendency) {
        maxTendency = t;
        maxId = action.id;
      }
    }
    if (maxId === null) return null;

    // 迟滞阈值：已高亮时需要降更低才取消，防止阈值附近闪烁
    const threshold = currentHighlightId === maxId
      ? HIGHLIGHT_RELEASE_THRESHOLD
      : HIGHLIGHT_THRESHOLD;

    return maxTendency > threshold ? maxId : null;
  }

  reset(): void {
    for (const id of this.tendencies.keys()) {
      this.tendencies.set(id, 0);
    }
    // L4：删除 lastUpdateTime 重置（死字段）
  }

  decay(): void {
    for (const id of this.tendencies.keys()) {
      const next = (this.tendencies.get(id) ?? 0) * EMA_DECAY;
      this.tendencies.set(id, next < MIN_TENDENCY ? 0 : next);
    }
  }
}
