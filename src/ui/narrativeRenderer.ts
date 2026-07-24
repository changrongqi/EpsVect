/**
 * 通用叙事流渲染器
 * 职责单一：接收容器元素和章节配置，生成叙事流 DOM
 * - IntersectionObserver 实现滚动渐入（双向：进入加 visible，离开移除，避免隐藏视图预触发）
 * - 鼠标视差让内容与星空背景处于同一空间系统
 * - 按 variant 渲染不同布局变体（standard / manifesto / feature）
 * - 支持 highlights 关键词高亮
 * - 支持 formulas 公式块（standard 与 feature 变体，段落之后渲染）
 * - 仅悬浮卡片 3D 倾斜（其余卡片静止，避免多卡片同时旋转的杂乱感）
 * - 完整生命周期：所有监听器存为实例字段，destroy() 可完整清理
 * 可被任意子界面复用（关于项目、源代码、数学推导等）
 */

import type { NarrativeSection, SectionVariant } from '../config/aboutContent';
import { renderParagraphWithHighlights, escapeHtml } from '../util/htmlUtils';

const PARALLAX_STRENGTH = 12;
const PARALLAX_LERP = 0.06;
const TILT_MAX_DEG = 6;

/** 将段落中的 highlights 关键词包裹为 <mark>（委托公共工具函数） */
function renderParagraph(text: string, highlights?: string[]): string {
  if (!highlights || highlights.length === 0) return escapeHtml(text);
  return renderParagraphWithHighlights(text, highlights);
}

interface TiltBinding {
  el: HTMLElement;
  onMove: (e: MouseEvent) => void;
  onLeave: () => void;
  // L11：新增 onEnter，需在 destroy 中移除
  onEnter: () => void;
}

export class NarrativeRenderer {
  private observer: IntersectionObserver | null = null;
  private parallaxTargetX = 0;
  private parallaxTargetY = 0;
  private parallaxCurrentX = 0;
  private parallaxCurrentY = 0;
  private parallaxRafId = 0;
  private parallaxContainer: HTMLElement | null = null;
  private totalSections = 0;
  private sectionEls: HTMLElement[] = [];
  // 视图是否激活（可见）。非激活时暂停 RAF，避免隐藏视图的无意义计算
  private active = true;

  // 保存监听器引用以便 destroy 时移除
  private parallaxView: HTMLElement | null = null;
  private progressView: HTMLElement | null = null;
  // L47/noUnusedLocals: progressFill/progressLabel 仅在 setupProgress 内通过闭包访问局部变量，
  // 不需要作为类字段保存
  private tiltBindings: TiltBinding[] = [];
  private onMouseMoveParallax: ((e: MouseEvent) => void) | null = null;
  private onScrollProgress: (() => void) | null = null;

  render(container: HTMLElement, sections: NarrativeSection[]): void {
    // render 前先清理旧状态，防止多次调用累积 RAF/监听器
    this.destroy();

    this.totalSections = sections.length;
    container.innerHTML = sections
      .map((s, i) => this.renderSection(s, i))
      .join('');

    this.sectionEls = Array.from(
      container.querySelectorAll<HTMLElement>('.narrative-card'),
    );

    this.setupScrollAnimation(container);
    this.setupParallax(container);
    this.setupTilt();
    this.setupProgress(container);
  }

  private renderSection(s: NarrativeSection, i: number): string {
    const variant: SectionVariant = s.variant ?? 'standard';
    const delay = i * 0.15;
    const paragraphs = s.paragraphs
      .map((p) => `<p>${renderParagraph(p, s.highlights)}</p>`)
      .join('');

    const formulasHtml = s.formulas
      ? `<div class="narrative-formulas">
          ${s.formulas
            .map(
              (f) =>
                `<div class="narrative-formula"><code class="narrative-formula-expr">${f.expr}</code>${f.caption ? `<span class="narrative-formula-caption">${f.caption}</span>` : ''}</div>`,
            )
            .join('')}
        </div>`
      : '';

    if (variant === 'manifesto') {
      return `
      <section class="narrative-section narrative-card narrative-manifesto" id="narrative-${s.id}" style="animation-delay: ${delay}s">
        <div class="narrative-card-glow"></div>
        <div class="narrative-quote-mark">"</div>
        <div class="narrative-manifesto-text">
          ${paragraphs}
        </div>
      </section>`;
    }

    if (variant === 'feature') {
      const metricsHtml = s.metrics
        ? `<div class="narrative-metrics">
            ${s.metrics
              .map(
                (m) =>
                  `<div class="narrative-metric"><span class="narrative-metric-value">${m.value}</span><span class="narrative-metric-label">${m.label}</span></div>`,
              )
              .join('')}
          </div>`
        : '';

      const flowHtml = s.flow
        ? `<div class="narrative-flow">
            ${s.flow
              .map(
                (node, fi) =>
                  `<div class="narrative-flow-node"><span class="narrative-flow-label">${node.label}</span>${node.sublabel ? `<span class="narrative-flow-sublabel">${node.sublabel}</span>` : ''}</div>${fi < s.flow!.length - 1 ? '<div class="narrative-flow-arrow"></div>' : ''}`,
              )
              .join('')}
          </div>`
        : '';

      return `
      <section class="narrative-section narrative-card narrative-feature" id="narrative-${s.id}" style="animation-delay: ${delay}s">
        <div class="narrative-card-glow"></div>
        <div class="narrative-index">${s.index}</div>
        <h3 class="narrative-heading">${s.title}</h3>
        <div class="narrative-line"></div>
        <div class="narrative-text">
          ${paragraphs}
        </div>
        ${formulasHtml}
        ${metricsHtml}
        ${flowHtml}
      </section>`;
    }

    // standard：奇偶交替对齐
    const align = i % 2 === 0 ? 'left' : 'right';
    return `
    <section class="narrative-section narrative-card narrative-standard narrative-align-${align}" id="narrative-${s.id}" style="animation-delay: ${delay}s">
      <div class="narrative-card-glow"></div>
      <div class="narrative-index">${s.index}</div>
      <h3 class="narrative-heading">${s.title}</h3>
      <div class="narrative-line"></div>
      <div class="narrative-text">
        ${paragraphs}
      </div>
      ${formulasHtml}
    </section>`;
  }

  private setupScrollAnimation(container: HTMLElement): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        // 双向处理：进入视口加 visible，离开视口移除 visible。
        // 这样滚动回顶部时卡片会重新渐入，而非一直保持 visible。
        // 注意：隐藏视图（opacity:0 但仍布局）下 observer 仍会判定 intersecting，
        // 所以首次切换进视图时卡片可能已有 visible（无渐入动画）——这是已知行为，
        // 双向处理主要保证滚动时的动态渐入效果。
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          } else {
            entry.target.classList.remove('visible');
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
    this.parallaxView = view;

    this.onMouseMoveParallax = (e: MouseEvent) => {
      const rect = view.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      this.parallaxTargetX = nx * PARALLAX_STRENGTH;
      this.parallaxTargetY = ny * PARALLAX_STRENGTH;
    };
    view.addEventListener('mousemove', this.onMouseMoveParallax);

    this.parallaxLoop();
  }

  /** 仅悬浮卡片计算 3D 倾斜，其余卡片保持静止 */
  private setupTilt(): void {
    for (const card of this.sectionEls) {
      // L11：mouseenter 时缓存 rect，mousemove 复用，避免每帧 getBoundingClientRect 触发重排
      let cachedRect: DOMRect | null = null;
      const onEnter = () => {
        cachedRect = card.getBoundingClientRect();
      };
      const onMove = (e: MouseEvent) => {
        // rect 未缓存或缓存失效（如 resize）时重新获取
        if (!cachedRect) cachedRect = card.getBoundingClientRect();
        const px = (e.clientX - cachedRect.left) / cachedRect.width - 0.5;
        const py = (e.clientY - cachedRect.top) / cachedRect.height - 0.5;
        const tiltY = px * TILT_MAX_DEG * 2;
        const tiltX = -py * TILT_MAX_DEG * 2;
        card.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
        card.style.setProperty('--glow-x', `${((px + 0.5) * 100).toFixed(0)}%`);
        card.style.setProperty('--glow-y', `${((py + 0.5) * 100).toFixed(0)}%`);
      };
      const onLeave = () => {
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
        cachedRect = null;
      };
      card.addEventListener('mouseenter', onEnter);
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      this.tiltBindings.push({ el: card, onMove, onLeave, onEnter });
    }
  }

  private setupProgress(container: HTMLElement): void {
    const view = container.closest('.sub-view') as HTMLElement | null;
    if (!view) return;
    this.progressView = view;

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
      this.sectionEls.forEach((el, i) => {
        const sectionCenter = el.offsetTop + el.offsetHeight / 2;
        const dist = Math.abs(sectionCenter - viewCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      const num = String(closest + 1).padStart(2, '0');
      const total = String(this.totalSections).padStart(2, '0');
      label.textContent = `${num} / ${total}`;
    };
    this.onScrollProgress = updateProgress;

    view.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  private parallaxLoop = (): void => {
    // 非激活时暂停 RAF（视图隐藏时不做无意义的 lerp 计算和 transform 赋值）
    if (!this.active) {
      this.parallaxRafId = 0;
      return;
    }
    this.parallaxCurrentX += (this.parallaxTargetX - this.parallaxCurrentX) * PARALLAX_LERP;
    this.parallaxCurrentY += (this.parallaxTargetY - this.parallaxCurrentY) * PARALLAX_LERP;

    if (this.parallaxContainer) {
      this.parallaxContainer.style.transform =
        `translate3d(${this.parallaxCurrentX.toFixed(2)}px, ${this.parallaxCurrentY.toFixed(2)}px, 0)`;
    }

    this.parallaxRafId = requestAnimationFrame(this.parallaxLoop);
  };

  /**
   * 设置视图激活状态。
   * 非激活时暂停视差 RAF，激活时恢复。
   * 由 bootstrap 的 onSwitch 回调调用，避免隐藏视图的无意义 RAF 计算。
   */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (active) {
      // 恢复 RAF（若之前已暂停）
      if (this.parallaxRafId === 0 && this.parallaxContainer) {
        this.parallaxRafId = requestAnimationFrame(this.parallaxLoop);
      }
    } else {
      // 暂停 RAF
      if (this.parallaxRafId !== 0) {
        cancelAnimationFrame(this.parallaxRafId);
        this.parallaxRafId = 0;
      }
    }
  }

  destroy(): void {
    // 1. 断开 observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    // 2. 取消 RAF
    cancelAnimationFrame(this.parallaxRafId);
    this.parallaxRafId = 0;
    // 3. 移除视差 mousemove
    if (this.parallaxView && this.onMouseMoveParallax) {
      this.parallaxView.removeEventListener('mousemove', this.onMouseMoveParallax);
    }
    this.onMouseMoveParallax = null;
    this.parallaxView = null;
    this.parallaxContainer = null;
    // 4. 移除进度 scroll
    if (this.progressView && this.onScrollProgress) {
      this.progressView.removeEventListener('scroll', this.onScrollProgress);
    }
    this.onScrollProgress = null;
    this.progressView = null;
    // 5. 移除卡片 tilt（L11：含 onEnter）
    for (const { el, onMove, onLeave, onEnter } of this.tiltBindings) {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    }
    this.tiltBindings = [];
    // 6. 重置状态
    this.sectionEls = [];
  }
}
