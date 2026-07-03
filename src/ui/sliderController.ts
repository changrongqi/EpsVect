/**
 * 滑块控制器
 * 处理所有滑块输入事件，将值变更通知给回调函数
 */

export interface SliderConfig {
  noiseSlider: HTMLInputElement;
  noiseValueEl: HTMLElement;
  mincutoffSlider: HTMLInputElement;
  mincutoffValueEl: HTMLElement;
  betaSlider: HTMLInputElement;
  betaValueEl: HTMLElement;
  trailSlider: HTMLInputElement;
  trailValueEl: HTMLElement;
  blendSlider: HTMLInputElement;
  blendValueEl: HTMLElement;
  qSlider: HTMLInputElement;
  qValueEl: HTMLElement;
  rSlider: HTMLInputElement;
  rValueEl: HTMLElement;
}

export interface SliderCallbacks {
  onNoiseChange: (value: number) => void;
  onMincutoffChange: (value: number) => void;
  onBetaChange: (value: number) => void;
  onTrailLengthChange: (value: number) => void;
  onBlendChange: (value: number) => void;
  onQChange: (value: number) => void;
  onRChange: (value: number) => void;
}

export class SliderController {
  private config: SliderConfig;
  private callbacks: SliderCallbacks;

  constructor(config: SliderConfig, callbacks: SliderCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
    this.initSliders();
  }

  private initSliders(): void {
    const {
      noiseSlider, noiseValueEl,
      mincutoffSlider, mincutoffValueEl,
      betaSlider, betaValueEl,
      trailSlider, trailValueEl,
      blendSlider, blendValueEl,
      qSlider, qValueEl,
      rSlider, rValueEl,
    } = this.config;

    noiseSlider.addEventListener('input', () => {
      const value = parseFloat(noiseSlider.value);
      noiseValueEl.textContent = value.toFixed(1);
      this.callbacks.onNoiseChange(value);
    });

    mincutoffSlider.addEventListener('input', () => {
      const value = parseFloat(mincutoffSlider.value);
      mincutoffValueEl.textContent = value.toFixed(1);
      this.callbacks.onMincutoffChange(value);
    });

    betaSlider.addEventListener('input', () => {
      const value = parseFloat(betaSlider.value);
      betaValueEl.textContent = value.toFixed(3);
      this.callbacks.onBetaChange(value);
    });

    trailSlider.addEventListener('input', () => {
      const value = parseInt(trailSlider.value, 10);
      trailValueEl.textContent = String(value);
      this.callbacks.onTrailLengthChange(value);
    });

    blendSlider.addEventListener('input', () => {
      const value = parseInt(blendSlider.value, 10);
      blendValueEl.textContent = String(value);
      this.callbacks.onBlendChange(value / 100);
    });

    qSlider.addEventListener('input', () => {
      const value = parseInt(qSlider.value, 10);
      qValueEl.textContent = String(value);
      this.callbacks.onQChange(value);
    });

    rSlider.addEventListener('input', () => {
      const value = parseInt(rSlider.value, 10);
      rValueEl.textContent = String(value);
      this.callbacks.onRChange(value);
    });
  }

  setInitialValues(values: {
    noise: number;
    mincutoff: number;
    beta: number;
    trailLength: number;
    blend: number;
    q: number;
    r: number;
  }): void {
    this.config.noiseValueEl.textContent = values.noise.toFixed(1);
    this.config.mincutoffValueEl.textContent = values.mincutoff.toFixed(1);
    this.config.betaValueEl.textContent = values.beta.toFixed(3);
    this.config.trailValueEl.textContent = String(values.trailLength);
    this.config.blendValueEl.textContent = String(values.blend);
    this.config.qValueEl.textContent = String(values.q);
    this.config.rValueEl.textContent = String(values.r);
  }
}