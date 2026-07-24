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

export function bindGlobalEvents(options: EventBindingOptions): (e: MouseEvent) => void {
  const { viewSwitcher, freezeController, panelRenderer, scheduler, mouseHandler, actionTendencyController, cursorManager } = options;

  const onMouseMove = (e: MouseEvent): void => {
    scheduler.onMouseMove();
    mouseHandler.onMouseMove(e, viewSwitcher.getCurrentView() !== 'algo-test');
    cursorManager.onMouseMove(e);
  };

  document.addEventListener('mousedown', (e) => {
    cursorManager.onMouseDown(e);
  });

  document.addEventListener('mouseup', () => {
    cursorManager.onMouseUp();
  });

  document.addEventListener('click', () => {
    // 拖动选中文字后抑制算法 click
    if (cursorManager.shouldSuppressClick()) return;

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
      const actionId = actionTendencyController.getActiveActionId();
      if (actionId === 'back-home') {
        viewSwitcher.switchTo('home');
      }
    }
  });

  document.querySelectorAll<HTMLElement>('.back-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      viewSwitcher.switchTo('home');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const frozen = freezeController.toggle();
      panelRenderer.setFrozen(frozen);
    }
  });

  document.addEventListener('mousemove', onMouseMove);

  return onMouseMove;
}
