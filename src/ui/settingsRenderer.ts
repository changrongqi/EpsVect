/**
 * 参数设置界面渲染器
 * 职责单一：接收容器、参数分组和预设方案，生成可交互的参数中心 DOM
 *
 * 视觉语言与 NarrativeRenderer 一致（玻璃卡片、青蓝光晕、流动装饰线、滚动渐入、3D 倾斜）
 * 但专为参数调参场景设计：每张卡片内嵌可交互滑块，顶部固定预设栏
 *
 * 交互：
 * - 滑块拖动 → onParamChange 回调
 * - 预设按钮点击 → onPresetApply 回调
 * - setParamValue：外部同步值（不触发回调，避免循环）
 */

import type { SettingsGroup, PresetProfile, ParamDef, ParamKey } from '../config/settingsContent';

const PARALLAX_STRENGTH = 12;
const PARALLAX_LERP = 0.06;
const TILT_MAX_DEG = 6;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 将段落中的 highlights 关键词包裹为 <mark> */
function renderParagraph(text: string, highlights?: string[]): string {
  if (!highlights || highlights.length === 0) return text;
  let result = text;
  for (const kw of highlights) {
    const re = new RegExp(escapeRegExp(kw), 'g');
    result = result.replace(re, `<mark class="narrative-keyword">${kw}</mark>`);
  }
  return result;
}

export interface SettingsRendererCallbacks {
  onParamChange: (key: ParamKey, value: number) => void;
  onPresetApply: (presetId: string) => void;
}

interface ParamBinding {
  key: ParamKey;
  slider: HTMLInputElement;
  valueEl: HTMLElement;
  format: (v: number) => string;
  /** 滑块原始值 → 回调值（如 blend 需 / 100） */
  transform?: (v: number) => number;
}

export class SettingsRenderer {
  private observer: IntersectionObserver | null = null;
  private parallaxTargetX = 0;
  private parallaxTargetY = 0;
  private parallaxCurrentX = 0;
  private parallaxCurrentY = 0;
  private parallaxRafId = 0;
  private parallaxContainer: HTMLElement | null = null;
  private totalGroups = 0;
  private groupEls: HTMLElement[] = [];
  private bindings: ParamBinding[] = [];
  private paramDefMap: Partial<Record<ParamKey, ParamDef>> = {};
  private callbacks: SettingsRendererCallbacks;
  private suppressCallback = false;

  constructor(callbacks: SettingsRendererCallbacks) {
    this.callbacks = callbacks;
  }

  render(container: HTMLElement, groups: SettingsGroup[], presets: PresetProfile[]): void {
    this.totalGroups = groups.length;
    // 建立 paramKey → ParamDef 映射，供 setupBindings 查找 format
    this.paramDefMap = {};
    for (const g of groups) {
      for (const p of g.params) {
        this.paramDefMap[p.key] = p;
      }
    }
    container.innerHTML = groups.map((g, i) => this.renderGroup(g, i)).join('');

    this.groupEls = Array.from(
      container.querySelectorAll<HTMLElement>('.narrative-card'),
    );

    this.setupBindings(container);
    this.setupPresetButtons(container, presets);
    this.setupScrollAnimation(container);
    this.setupParallax(container);
    this.setupTilt();
    this.setupProgress(container);
  }

  private renderGroup(g: SettingsGroup, i: number): string {
    const delay = i * 0.15;
    const paragraphs = g.paragraphs
      .map((p) => `<p>${renderParagraph(p, g.highlights)}</p>`)
      .join('');
    const paramsHtml = g.params.map((p) => this.renderParam(p)).join('');

    const align = i % 2 === 0 ? 'left' : 'right';
    const variantClass = g.variant === 'feature' ? 'narrative-feature' : `narrative-standard narrative-align-${align}`;
    const settingsVariantClass = `settings-variant-${g.variant}`;

    return `
    <section class="narrative-section narrative-card settings-card ${variantClass} ${settingsVariantClass}" id="settings-group-${g.id}" style="animation-delay: ${delay}s">
      <div class="narrative-card-glow"></div>
      <div class="narrative-index">${g.index}</div>
      <h3 class="narrative-heading">${g.title}</h3>
      <div class="narrative-line"></div>
      <div class="narrative-text">
        ${paragraphs}
      </div>
      <div class="settings-params">
        ${paramsHtml}
      </div>
    </section>`;
  }

  private renderParam(p: ParamDef): string {
    const valueDisplay = p.format(p.defaultValue);
    return `
    <div class="settings-param" data-param-key="${p.key}">
      <div class="settings-param-row">
        <label class="settings-param-label" for="settings-${p.key}-slider">${p.label}</label>
        <input
          type="range"
          id="settings-${p.key}-slider"
          class="settings-param-slider"
          min="${p.min}"
          max="${p.max}"
          step="${p.step}"
          value="${p.defaultValue}"
        />
        <span class="settings-param-value" id="settings-${p.key}-value">${valueDisplay}${p.unit ? `<span class="settings-param-unit">${p.unit}</span>` : ''}</span>
      </div>
      <p class="settings-param-desc">${p.description}</p>
      <p class="settings-param-recommend">${p.recommendation}</p>
    </div>`;
  }

  private setupBindings(container: HTMLElement): void {
    this.bindings = [];
    for (const card of this.groupEls) {
      const paramEls = card.querySelectorAll<HTMLElement>('.settings-param');
      for (const paramEl of paramEls) {
        const key = paramEl.dataset.paramKey as ParamKey;
        const slider = paramEl.querySelector<HTMLInputElement>('.settings-param-slider');
        const valueEl = paramEl.querySelector<HTMLElement>('.settings-param-value');
        if (!slider || !valueEl || !key) continue;

        // 找到对应的 ParamDef 以获取 format/transform
        const paramDef = this.findParamDef(key);
        if (!paramDef) continue;

        const binding: ParamBinding = {
          key,
          slider,
          valueEl,
          format: paramDef.format,
        };
        this.bindings.push(binding);

        slider.addEventListener('input', () => {
          const rawValue = parseFloat(slider.value);
          if (this.suppressCallback) {
            this.updateValueDisplay(binding, rawValue);
            return;
          }
          this.updateValueDisplay(binding, rawValue);
          const callbackValue = binding.transform ? binding.transform(rawValue) : rawValue;
          this.callbacks.onParamChange(key, callbackValue);
        });
      }
    }
  }

  private findParamDef(key: ParamKey): ParamDef | null {
    return this.paramDefMap[key] ?? null;
  }

  private updateValueDisplay(binding: ParamBinding, rawValue: number): void {
    const formatted = binding.format(rawValue);
    // 保留 unit span
    const unitSpan = binding.valueEl.querySelector('.settings-param-unit');
    binding.valueEl.textContent = formatted;
    if (unitSpan) {
      binding.valueEl.appendChild(unitSpan);
    }
  }

  /** 外部同步值（不触发 onParamChange 回调，避免循环） */
  setParamValue(key: ParamKey, value: number): void {
    const binding = this.bindings.find((b) => b.key === key);
    if (!binding) return;
    this.suppressCallback = true;
    binding.slider.value = String(value);
    this.updateValueDisplay(binding, value);
    this.suppressCallback = false;
  }

  /** 批量设置所有参数值（预设应用时调用） */
  setAllParamValues(values: Record<ParamKey, number>): void {
    this.suppressCallback = true;
    for (const binding of this.bindings) {
      const v = values[binding.key];
      if (v === undefined) continue;
      binding.slider.value = String(v);
      this.updateValueDisplay(binding, v);
    }
    this.suppressCallback = false;
  }

  private setupPresetButtons(_container: HTMLElement, presets: PresetProfile[]): void {
    const presetBar = document.querySelector<HTMLElement>('.settings-presets');
    if (!presetBar) return;

    const buttons = presetBar.querySelectorAll<HTMLButtonElement>('.preset-btn');
    buttons.forEach((btn) => {
      const presetId = btn.dataset.preset;
      if (!presetId) return;
      btn.addEventListener('click', () => {
        const preset = presets.find((p) => p.id === presetId);
        if (!preset) return;
        this.setAllParamValues(preset.values);
        this.callbacks.onPresetApply(presetId);
        this.highlightActivePreset(btn);
      });
    });
  }

  private highlightActivePreset(activeBtn: HTMLButtonElement): void {
    const allBtns = document.querySelectorAll<HTMLButtonElement>('.preset-btn');
    allBtns.forEach((b) => b.classList.remove('preset-active'));
    activeBtn.classList.add('preset-active');
  }

  private setupScrollAnimation(container: HTMLElement): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        }
      },
      {
        root: container.closest('.sub-view') as HTMLElement | null,
        threshold: 0.15,
        rootMargin: '0px 0px -80px 0px',
      },
    );

    container.querySelectorAll('.narrative-section').forEach((el) => {
      this.observer!.observe(el);
    });
  }

  private setupParallax(container: HTMLElement): void {
    this.parallaxContainer = container;

    const view = container.closest('.sub-view') as HTMLElement | null;
    if (!view) return;

    view.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = view.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      this.parallaxTargetX = nx * PARALLAX_STRENGTH;
      this.parallaxTargetY = ny * PARALLAX_STRENGTH;
    });

    this.parallaxLoop();
  }

  private setupTilt(): void {
    for (const card of this.groupEls) {
      card.addEventListener('mousemove', (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        const tiltY = px * TILT_MAX_DEG * 2;
        const tiltX = -py * TILT_MAX_DEG * 2;
        card.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
        card.style.setProperty('--glow-x', `${((px + 0.5) * 100).toFixed(0)}%`);
        card.style.setProperty('--glow-y', `${((py + 0.5) * 100).toFixed(0)}%`);
      });

      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
      });
    }
  }

  private setupProgress(container: HTMLElement): void {
    const view = container.closest('.sub-view') as HTMLElement | null;
    if (!view) return;

    const fill = view.querySelector<HTMLElement>('.narrative-progress-fill');
    const label = view.querySelector<HTMLElement>('.narrative-progress-label');
    if (!fill || !label) return;

    const updateProgress = (): void => {
      const scrollTop = view.scrollTop;
      const scrollMax = view.scrollHeight - view.clientHeight;
      const ratio = scrollMax > 0 ? scrollTop / scrollMax : 0;
      fill.style.height = `${(ratio * 100).toFixed(1)}%`;

      const viewCenter = scrollTop + view.clientHeight / 2;
      let closest = 0;
      let minDist = Infinity;
      this.groupEls.forEach((el, i) => {
        const sectionCenter = el.offsetTop + el.offsetHeight / 2;
        const dist = Math.abs(sectionCenter - viewCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      const num = String(closest + 1).padStart(2, '0');
      const total = String(this.totalGroups).padStart(2, '0');
      label.textContent = `${num} / ${total}`;
    };

    view.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  private parallaxLoop = (): void => {
    this.parallaxCurrentX += (this.parallaxTargetX - this.parallaxCurrentX) * PARALLAX_LERP;
    this.parallaxCurrentY += (this.parallaxTargetY - this.parallaxCurrentY) * PARALLAX_LERP;

    if (this.parallaxContainer) {
      this.parallaxContainer.style.transform =
        `translate3d(${this.parallaxCurrentX.toFixed(2)}px, ${this.parallaxCurrentY.toFixed(2)}px, 0)`;
    }

    this.parallaxRafId = requestAnimationFrame(this.parallaxLoop);
  };

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    cancelAnimationFrame(this.parallaxRafId);
  }
}
