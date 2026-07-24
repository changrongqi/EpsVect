import { ActionTendency, ActionConfig, ActionRenderData } from './actionTendency';

interface ActionTendencyControllerOptions {
  onActionsUpdate?: (actions: ActionRenderData[]) => void;
}

const HIGHLIGHT_CLASS = 'action-highlight';
const ACTIVE_CLASS = 'action-active';
const RECT_REFRESH_INTERVAL_MS = 1000;

export class ActionTendencyController {
  private actionTendency: ActionTendency | null = null;
  private lastHighlightId: string | null = null;
  private readonly onActionsUpdate?: (actions: ActionRenderData[]) => void;
  private currentViewId: string | null = null;
  private lastRectRefreshTime = 0;
  // 元素引用缓存：避免每帧 DOM 查询（热路径性能优化）
  private elementCache: Map<string, HTMLElement> = new Map();

  constructor(options?: ActionTendencyControllerOptions) {
    this.onActionsUpdate = options?.onActionsUpdate;
  }

  registerView(viewId: string, actions: ActionConfig[]): void {
    this.clearHighlights();
    this.currentViewId = viewId;
    this.actionTendency = new ActionTendency(actions);
    this.lastRectRefreshTime = performance.now();
    this.rebuildElementCache();
  }

  unregisterView(): void {
    this.clearHighlights();
    this.actionTendency = null;
    this.currentViewId = null;
    this.lastHighlightId = null;
    this.elementCache.clear();
  }

  update(predictedTheta: number): void {
    if (!this.actionTendency || !this.currentViewId) return;

    const now = performance.now();
    if (now - this.lastRectRefreshTime >= RECT_REFRESH_INTERVAL_MS) {
      this.refreshActionRects();
      this.lastRectRefreshTime = now;
    }

    this.actionTendency.update(predictedTheta);

    const renderData = this.actionTendency.getRenderData();
    this.onActionsUpdate?.(renderData);

    this.applyHighlights(renderData);
  }

  private rebuildElementCache(): void {
    this.elementCache.clear();
    if (!this.currentViewId) return;
    const viewEl = document.getElementById(`${this.currentViewId}-view`);
    if (!viewEl) return;
    viewEl.querySelectorAll<HTMLElement>('[data-action-id]').forEach((el) => {
      const id = el.dataset.actionId;
      if (id) {
        this.elementCache.set(id, el);
      }
    });
  }

  private refreshActionRects(): void {
    if (!this.actionTendency || !this.currentViewId) return;

    const viewEl = document.getElementById(`${this.currentViewId}-view`);
    if (!viewEl) return;

    // 同步刷新元素缓存（防止 DOM 重建后引用失效）
    this.rebuildElementCache();

    const configs: ActionConfig[] = [];
    this.elementCache.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      configs.push({
        id,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
    });

    if (configs.length > 0) {
      this.actionTendency.updateActionRects(configs);
    }
  }

  private queryActionElement(id: string): HTMLElement | null {
    return this.elementCache.get(id) ?? null;
  }

  private applyHighlights(renderData: ActionRenderData[]): void {
    const highlightId = this.actionTendency?.getHighestTendencyAction(this.lastHighlightId) ?? null;

    if (this.lastHighlightId !== highlightId) {
      if (this.lastHighlightId) {
        this.removeHighlight(this.lastHighlightId);
      }
      if (highlightId) {
        this.addHighlight(highlightId);
      }
      this.lastHighlightId = highlightId;
    }

    for (const data of renderData) {
      const el = this.queryActionElement(data.id);
      if (!el) continue;
      el.style.setProperty('--tendency', String(data.tendency));
      // 指数化视觉值：高置信度强高亮，低置信度明显弱化
      // pow(t, 2.5)：0.3→0.049, 0.5→0.177, 0.7→0.41, 0.9→0.769
      const visValue = Math.pow(data.tendency, 2.5);
      el.style.setProperty('--tendency-vis', String(visValue));
    }
  }

  private addHighlight(id: string): void {
    const el = this.queryActionElement(id);
    if (el) {
      el.classList.add(HIGHLIGHT_CLASS);
      el.classList.add(ACTIVE_CLASS);
    }
  }

  private removeHighlight(id: string): void {
    const el = this.queryActionElement(id);
    if (el) {
      el.classList.remove(HIGHLIGHT_CLASS);
      el.classList.remove(ACTIVE_CLASS);
    }
  }

  clearHighlights(): void {
    if (!this.currentViewId) return;
    const viewEl = document.getElementById(`${this.currentViewId}-view`);
    if (!viewEl) return;
    // 重置所有 action 元素的样式：移除高亮类 + 清理 CSS 变量
    // 否则视图切换后旧元素仍保留 --tendency-vis 导致视觉残留
    viewEl.querySelectorAll<HTMLElement>('[data-action-id]').forEach((el) => {
      el.classList.remove(HIGHLIGHT_CLASS);
      el.classList.remove(ACTIVE_CLASS);
      el.style.removeProperty('--tendency');
      el.style.removeProperty('--tendency-vis');
    });
    this.lastHighlightId = null;
  }

  getActiveActionId(): string | null {
    return this.actionTendency?.getHighestTendencyAction(this.lastHighlightId) || null;
  }

  reset(): void {
    this.clearHighlights();
    this.actionTendency?.reset();
  }

  decay(): void {
    if (!this.actionTendency) return;
    this.actionTendency.decay();
    const renderData = this.actionTendency.getRenderData();
    // 衰减期间也需通知下游（与 update 保持一致），否则渲染数据停滞在旧值
    this.onActionsUpdate?.(renderData);
    this.applyHighlights(renderData);
  }
}
