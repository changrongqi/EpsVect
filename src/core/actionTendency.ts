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

export class ActionTendency {
  private configs: ActionConfig[];
  private tendencies: number[];
  private lastUpdateTime = 0;
  private maxDistance: number;

  constructor(configs: ActionConfig[]) {
    this.configs = configs;
    this.tendencies = new Array(configs.length).fill(0);
    this.maxDistance = this.computeMaxDistance();
  }

  private computeMaxDistance(): number {
    return Math.sqrt(
      (window.innerWidth / 2) ** 2 + (window.innerHeight / 2) ** 2,
    );
  }

  updateActionRects(configs: ActionConfig[]): void {
    this.configs = configs;
    this.maxDistance = this.computeMaxDistance();
  }

  update(predictedTheta: number): void {
    const now = performance.now();
    this.lastUpdateTime = now;

    for (let i = 0; i < this.configs.length; i++) {
      const action = this.configs[i];
      const cx = action.x + action.width / 2;
      const cy = action.y + action.height / 2;

      const dx = cx - window.innerWidth / 2;
      const dy = cy - window.innerHeight / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const targetTheta = Math.atan2(dy, dx);
      const alignment = Math.max(0, Math.cos(predictedTheta - targetTheta));

      const distanceFactor = Math.max(0.3, 1 - dist / this.maxDistance);
      const weightedAlignment = alignment * distanceFactor;

      this.tendencies[i] = this.tendencies[i] * EMA_DECAY + weightedAlignment * EMA_ALPHA;
      if (this.tendencies[i] < MIN_TENDENCY) this.tendencies[i] = 0;
      if (this.tendencies[i] > 1) this.tendencies[i] = 1;
    }
  }

  getRenderData(): ActionRenderData[] {
    return this.configs.map((action, i) => ({
      id: action.id,
      tendency: this.tendencies[i],
      x: action.x,
      y: action.y,
      width: action.width,
      height: action.height,
    }));
  }

  getHighestTendencyAction(currentHighlightId?: string | null): string | null {
    let maxTendency = 0;
    let maxIndex = -1;
    for (let i = 0; i < this.tendencies.length; i++) {
      if (this.tendencies[i] > maxTendency) {
        maxTendency = this.tendencies[i];
        maxIndex = i;
      }
    }
    if (maxIndex < 0) return null;

    // 迟滞阈值：已高亮时需要降更低才取消，防止阈值附近闪烁
    const threshold = currentHighlightId === this.configs[maxIndex].id
      ? HIGHLIGHT_RELEASE_THRESHOLD
      : HIGHLIGHT_THRESHOLD;

    return maxTendency > threshold ? this.configs[maxIndex].id : null;
  }

  reset(): void {
    this.tendencies.fill(0);
    this.lastUpdateTime = 0;
  }

  decay(): void {
    for (let i = 0; i < this.tendencies.length; i++) {
      this.tendencies[i] *= EMA_DECAY;
      if (this.tendencies[i] < MIN_TENDENCY) this.tendencies[i] = 0;
    }
  }
}
