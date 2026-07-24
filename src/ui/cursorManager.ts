/**
 * 自定义光标管理器
 * 职责单一：管理光标的显隐、位置跟随、状态切换和拖动检测
 *
 * 显隐策略（hover 目标驱动，所有界面统一）：
 *   - hover 到可交互元素（按钮、滑块、输入框、可选文字、卡片等）→ 显示
 *   - hover 到非交互区域（画布、星空、纯背景）→ 隐藏
 *   - 拖动时显示（无论 hover 目标）
 *
 * 光标状态：
 *   - default：青蓝色圆环 + 中心点（hover 交互控件）
 *   - text：竖线（hover 可选文字）
 *   - dragging：圆环高亮（拖动选中时）
 *
 * 拖动检测：
 *   - mousedown 后移动超过阈值判定为拖动
 *   - 拖动结束后抑制一次 click，防止算法误触发
 */

import type { ViewName } from './viewSwitcher';

const DRAG_THRESHOLD = 5; // px，mousedown 后移动超过此距离判定为拖动

/** 可交互元素的选择器（hover 到这些元素时显示光标） */
const INTERACTIVE_SELECTOR = [
  'button',
  'input',
  'select',
  'textarea',
  'a',
  'label',
  '[data-action-id]',
  '.back-btn',
  '.narrative-card',
  '.narrative-flow-node',
  '.control-group',
  '.slider-container',
  '.sub-view-content',
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'li', 'code', 'pre',
  '.narrative-text',
  '.narrative-manifesto-text',
  '.narrative-metric',
  '.narrative-metric-value',
  '.narrative-metric-label',
  '.narrative-heading',
  '.narrative-index',
  '.narrative-keyword',
  '.placeholder-text',
  '.sub-view-title',
  '.sub-view-body',
  '.settings-card',
  '.settings-param',
  '.settings-presets',
  '.preset-btn',
  '.settings-param-desc',
  '.settings-param-recommend',
  '.settings-param-value',
  '.settings-presets-label',
].join(', ');

/** 可选文字区域的选择器（hover 时切换为 text 竖线光标） */
const TEXT_SELECTOR = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'span', 'li', 'code', 'pre',
  '.narrative-text',
  '.narrative-manifesto-text',
  '.sub-view-body',
  '.placeholder-text',
  '.settings-param-desc',
  '.settings-param-recommend',
  '.settings-presets-label',
].join(', ');

type CursorMode = 'default' | 'text' | 'dragging';

export class CursorManager {
  private el: HTMLElement;
  private mode: CursorMode = 'default';
  private mouseDownX = 0;
  private mouseDownY = 0;
  private dragging = false;
  private mouseDown = false;
  private suppressClickFlag = false;
  private visible = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'custom-cursor';
    this.el.classList.add('cursor-default', 'cursor-hidden');
    document.body.appendChild(this.el);
  }

  /** 界面切换时重置状态（不再区分界面类型，统一 hover 驱动） */
  setVisibleForView(_view: ViewName): void {
    this.dragging = false;
    this.mouseDown = false;
    this.suppressClickFlag = false;
    this.setMode('default');
    this.hide();
  }

  /** 拖动结束后应抑制一次算法 click，返回 true 表示需要抑制 */
  shouldSuppressClick(): boolean {
    if (this.suppressClickFlag) {
      this.suppressClickFlag = false;
      return true;
    }
    return false;
  }

  onMouseDown(e: MouseEvent): void {
    this.mouseDown = true;
    this.mouseDownX = e.clientX;
    this.mouseDownY = e.clientY;
    this.dragging = false;
  }

  onMouseMove(e: MouseEvent): void {
    // 更新光标位置
    this.el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;

    // 拖动检测
    if (this.mouseDown && !this.dragging) {
      const dx = e.clientX - this.mouseDownX;
      const dy = e.clientY - this.mouseDownY;
      if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
        this.dragging = true;
        this.setMode('dragging');
        this.show();
      }
      return;
    }

    // 拖动中：保持显示
    if (this.dragging) return;

    // 非拖动：根据 hover 目标决定显隐和模式
    const target = e.target as HTMLElement | null;
    if (this.isInteractive(target)) {
      this.setMode(this.isSelectableText(target) ? 'text' : 'default');
      this.show();
    } else {
      this.hide();
    }
  }

  onMouseUp(): void {
    if (this.dragging) {
      this.suppressClickFlag = true;
    }
    this.mouseDown = false;
    this.dragging = false;
    this.setMode('default');
    // 松开后根据当前 hover 目标重新判断显隐
    this.hide();
  }

  /** 判断目标元素是否为可交互元素 */
  private isInteractive(el: HTMLElement | null): boolean {
    if (!el) return false;
    return !!el.closest(INTERACTIVE_SELECTOR);
  }

  /** 判断目标元素是否为可选文字区域 */
  private isSelectableText(el: HTMLElement | null): boolean {
    if (!el) return false;
    return !!el.closest(TEXT_SELECTOR);
  }

  private show(): void {
    if (!this.visible) {
      this.visible = true;
      this.el.classList.remove('cursor-hidden');
    }
  }

  private hide(): void {
    if (this.visible) {
      this.visible = false;
      this.el.classList.add('cursor-hidden');
    }
  }

  private setMode(mode: CursorMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.el.classList.remove('cursor-default', 'cursor-text', 'cursor-dragging');
    this.el.classList.add(`cursor-${mode}`);
  }

  destroy(): void {
    this.el.remove();
  }
}
