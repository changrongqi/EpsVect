/**
 * 视图切换器
 * 管理多个视图的显示/隐藏切换，支持快速丝滑过渡
 */

export type ViewName = 'home' | 'algo-test' | 'about' | 'settings' | 'source-code' | 'math-derivation';

export class ViewSwitcher {
  private currentView: ViewName = 'home';
  private views: Map<ViewName, HTMLElement> = new Map();
  private onSwitchCallbacks: ((view: ViewName) => void)[] = [];

  register(viewName: ViewName, element: HTMLElement): void {
    this.views.set(viewName, element);
    element.classList.toggle('active', viewName === this.currentView);
  }

  switchTo(viewName: ViewName): void {
    if (viewName === this.currentView) return;
    const target = this.views.get(viewName);
    const current = this.views.get(this.currentView);
    if (!target) return;

    if (current) current.classList.remove('active');
    target.classList.add('active');
    this.currentView = viewName;

    // L17：try/catch 包裹每个回调，避免单个回调抛异常阻断后续回调
    for (const cb of this.onSwitchCallbacks) {
      try {
        cb(viewName);
      } catch (err) {
        console.error('[ViewSwitcher] onSwitch callback error:', err);
      }
    }
  }

  getCurrentView(): ViewName {
    return this.currentView;
  }

  /**
   * 注册视图切换回调。
   * L16：返回取消订阅函数，调用后移除该回调，避免回调数组只增不减。
   */
  onSwitch(callback: (view: ViewName) => void): () => void {
    this.onSwitchCallbacks.push(callback);
    return () => {
      const idx = this.onSwitchCallbacks.indexOf(callback);
      if (idx >= 0) {
        this.onSwitchCallbacks.splice(idx, 1);
      }
    };
  }

  /** L16：destroy 时清空回调数组，防止 HMR 重载时回调累积 */
  destroy(): void {
    this.onSwitchCallbacks.length = 0;
    this.views.clear();
  }
}
