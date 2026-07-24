/**
 * 通用叙事流渲染器
 * 职责单一：接收容器元素和章节配置，生成叙事流 DOM
 * - IntersectionObserver 实现滚动渐入
 * - 鼠标视差让内容与星空背景处于同一空间系统
 * - 按 variant 渲染不同布局变体（standard / manifesto / feature）
 * - 支持 highlights 关键词高亮
 * - 支持 formulas 公式块（standard 与 feature 变体，段落之后渲染）
 * - 仅悬浮卡片 3D 倾斜（其余卡片静止，避免多卡片同时旋转的杂乱感）
 * 可被任意子界面复用（关于项目、源代码、数学推导等）
 */

import type { NarrativeSection, SectionVariant } from '../config/aboutContent';

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

  render(container: HTMLElement, sections: NarrativeSection[]): void {
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

  /** 仅悬浮卡片计算 3D 倾斜，其余卡片保持静止 */
  private setupTilt(): void {
    for (const card of this.sectionEls) {
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
