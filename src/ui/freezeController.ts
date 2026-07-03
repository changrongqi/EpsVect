/**
 * 冻结控制器
 * 管理信息面板的冻结/解冻状态
 */

export interface FreezeConfig {
  infoPanel: HTMLElement;
  freezeIndicatorEl: HTMLElement;
}

export class FreezeController {
  private config: FreezeConfig;
  private frozen = false;

  constructor(config: FreezeConfig) {
    this.config = config;
  }

  toggle(): boolean {
    this.frozen = !this.frozen;
    if (this.frozen) {
      this.config.infoPanel.classList.add('frozen');
      this.config.freezeIndicatorEl.textContent = '已冻结';
    } else {
      this.config.infoPanel.classList.remove('frozen');
      this.config.freezeIndicatorEl.textContent = '实时';
    }
    return this.frozen;
  }

  get isFrozen(): boolean {
    return this.frozen;
  }
}