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

    this.onSwitchCallbacks.forEach((cb) => cb(viewName));
  }

  getCurrentView(): ViewName {
    return this.currentView;
  }

  onSwitch(callback: (view: ViewName) => void): void {
    this.onSwitchCallbacks.push(callback);
  }
}
