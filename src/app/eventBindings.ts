import { ViewSwitcher } from '../ui/viewSwitcher';
import { FreezeController } from '../ui/freezeController';
import { PanelRenderer } from '../ui/panelRenderer';
import { TendencyController } from '../core/tendencyController';
import { AppScheduler } from '../core/appScheduler';
import { MouseHandler } from '../core/mouseHandler';
import { ActionTendencyController } from '../core/actionTendencyController';
import { CursorManager } from '../ui/cursorManager';
import { ENTRY_CONFIGS } from '../config/entryConfig';
import { getHighlightedEntry } from '../renderer/canvas';

export interface EventBindingOptions {
  viewSwitcher: ViewSwitcher;
  freezeController: FreezeController;
  panelRenderer: PanelRenderer;
  tendencyController: TendencyController;
  scheduler: AppScheduler;
  mouseHandler: MouseHandler;
  actionTendencyController: ActionTendencyController;
  cursorManager: CursorManager;
}

export function bindGlobalEvents(options: EventBindingOptions): { onMouseMove: (e: MouseEvent) => void; cleanup: () => void } {
  const { viewSwitcher, freezeController, panelRenderer, scheduler, mouseHandler, actionTendencyController, cursorManager } = options;

  const onMouseMove = (e: MouseEvent): void => {
    scheduler.onMouseMove();
    mouseHandler.onMouseMove(e, viewSwitcher.getCurrentView() !== 'algo-test');
    cursorManager.onMouseMove(e);
  };

  const onMouseDown = (e: MouseEvent): void => {
    cursorManager.onMouseDown(e);
  };

  const onMouseUp = (): void => {
    cursorManager.onMouseUp();
  };

  // 重入保护：防止 target.click() 冒泡回 document 递归触发 onClick 导致栈溢出
  let isDispatching = false;

  /**
   * 判断点击目标是否为"原生可交互控件"。
   * 若是，则 click-anywhere 不应拦截（让控件正常工作），
   * 否则用户点滑块/预设按钮等会被误判为触发高亮 action。
   */
  const isNativeInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    // input（含 range 滑块）、textarea、select、button、a、带 contenteditable 的元素
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a') {
      return true;
    }
    if (target.isContentEditable) return true;
    // label 点击会转发到关联控件，也视为原生交互
    if (tag === 'label') return true;
    return false;
  };

  const onClick = (e: MouseEvent): void => {
    // 拖动选中文字后抑制算法 click
    if (cursorManager.shouldSuppressClick()) return;
    // 重入保护：由本处理器触发的 target.click() 冒泡回来时直接跳过
    if (isDispatching) return;

    const currentView = viewSwitcher.getCurrentView();
    if (currentView === 'home') {
      const entryId = getHighlightedEntry();
      if (entryId) {
        const config = ENTRY_CONFIGS.find((c) => c.id === entryId);
        if (config) {
          viewSwitcher.switchTo(config.dataView);
        }
      }
    } else {
      // 子界面：click-anywhere 交互。
      // 若用户点击的是原生可交互控件（滑块、按钮、输入框等），则不触发高亮 action，
      // 让控件正常响应。仅当点击非交互区域时才触发当前高亮按钮。
      if (isNativeInteractiveTarget(e.target)) return;

      const actionId = actionTendencyController.getActiveActionId();
      if (!actionId) return;
      if (actionId === 'back-home') {
        viewSwitcher.switchTo('home');
        return;
      }
      // 通用分发：查找带 data-action-id 的高亮按钮并触发其原生 click
      // L28：target.click() 会触发该按钮自身及祖先链上的 click 监听器，
      // 已通过 isDispatching 重入保护防止 document 的 onClick 递归；
      // 祖先链上若有非 document 的 click 监听器需自行 stopPropagation 避免重复触发
      const viewEl = document.getElementById(`${currentView}-view`);
      const target = viewEl?.querySelector<HTMLElement>(`[data-action-id="${actionId}"]`);
      if (target) {
        isDispatching = true;
        try {
          target.click();
        } finally {
          isDispatching = false;
        }
      }
    }
  };

  // .back-btn 监听器：保存引用以便清理
  const backBtnHandlers: Array<{ btn: HTMLElement; handler: (e: MouseEvent) => void }> = [];
  document.querySelectorAll<HTMLElement>('.back-btn').forEach((btn) => {
    const handler = (e: MouseEvent) => {
      e.stopPropagation();
      viewSwitcher.switchTo('home');
    };
    btn.addEventListener('click', handler);
    backBtnHandlers.push({ btn, handler });
  });

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === ' ' || e.code === 'Space') {
      // 焦点在可交互控件上时不拦截 Space（让滑块步进、按钮点击、文本输入等正常工作）
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') {
          return;
        }
        if (target.isContentEditable) return;
      }
      e.preventDefault();
      const frozen = freezeController.toggle();
      panelRenderer.setFrozen(frozen);
    }
  };

  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeyDown);
  // L29：mousemove 标记 passive，告知浏览器不会 preventDefault，允许并行优化滚动/合成
  document.addEventListener('mousemove', onMouseMove, { passive: true });

  const cleanup = (): void => {
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('mousemove', onMouseMove);
    for (const { btn, handler } of backBtnHandlers) {
      btn.removeEventListener('click', handler);
    }
  };

  return { onMouseMove, cleanup };
}
