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

type SliderKey = keyof SliderConfig;

interface SliderBinding {
  sliderKey: SliderKey;
  valueKey: SliderKey;
  callback: (value: number) => void;
  parse: (val: string) => number;
  format: (val: number) => string;
  transform?: (val: number) => number;
  // 保存 handler 引用以便 destroy 时移除（HMR 安全）
  handler?: (e: Event) => void;
}

export class SliderController {
  private config: SliderConfig;
  private bindings: SliderBinding[];

  constructor(config: SliderConfig, callbacks: SliderCallbacks) {
    this.config = config;
    this.bindings = this.buildBindings(callbacks);
    this.initSliders();
  }

  private buildBindings(callbacks: SliderCallbacks): SliderBinding[] {
    return [
      {
        sliderKey: 'noiseSlider',
        valueKey: 'noiseValueEl',
        callback: callbacks.onNoiseChange,
        parse: parseFloat,
        format: (v) => v.toFixed(1),
      },
      {
        sliderKey: 'mincutoffSlider',
        valueKey: 'mincutoffValueEl',
        callback: callbacks.onMincutoffChange,
        parse: parseFloat,
        format: (v) => v.toFixed(1),
      },
      {
        sliderKey: 'betaSlider',
        valueKey: 'betaValueEl',
        callback: callbacks.onBetaChange,
        parse: parseFloat,
        format: (v) => v.toFixed(3),
      },
      {
        sliderKey: 'trailSlider',
        valueKey: 'trailValueEl',
        callback: callbacks.onTrailLengthChange,
        parse: (v) => parseInt(v, 10),
        format: (v) => String(v),
      },
      {
        sliderKey: 'blendSlider',
        valueKey: 'blendValueEl',
        callback: callbacks.onBlendChange,
        parse: (v) => parseInt(v, 10),
        format: (v) => String(v),
        transform: (v) => v / 100,
      },
      {
        sliderKey: 'qSlider',
        valueKey: 'qValueEl',
        callback: callbacks.onQChange,
        parse: (v) => parseInt(v, 10),
        format: (v) => String(v),
      },
      {
        sliderKey: 'rSlider',
        valueKey: 'rValueEl',
        callback: callbacks.onRChange,
        parse: (v) => parseInt(v, 10),
        format: (v) => String(v),
      },
    ];
  }

  private initSliders(): void {
    for (const binding of this.bindings) {
      const slider = this.config[binding.sliderKey] as HTMLInputElement;
      const valueEl = this.config[binding.valueKey] as HTMLElement;

      const handler = () => {
        const rawValue = binding.parse(slider.value);
        valueEl.textContent = binding.format(rawValue);
        const callbackValue = binding.transform ? binding.transform(rawValue) : rawValue;
        binding.callback(callbackValue);
      };
      binding.handler = handler;
      slider.addEventListener('input', handler);
    }
  }

  destroy(): void {
    for (const binding of this.bindings) {
      if (binding.handler) {
        const slider = this.config[binding.sliderKey] as HTMLInputElement;
        slider.removeEventListener('input', binding.handler);
      }
    }
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
    // 同步更新滑块位置和显示文本，避免两者不一致
    const pairs: Array<{ sliderKey: SliderKey; valueKey: SliderKey; val: number; fmt: (v: number) => string }> = [
      { sliderKey: 'noiseSlider', valueKey: 'noiseValueEl', val: values.noise, fmt: (v) => v.toFixed(1) },
      { sliderKey: 'mincutoffSlider', valueKey: 'mincutoffValueEl', val: values.mincutoff, fmt: (v) => v.toFixed(1) },
      { sliderKey: 'betaSlider', valueKey: 'betaValueEl', val: values.beta, fmt: (v) => v.toFixed(3) },
      { sliderKey: 'trailSlider', valueKey: 'trailValueEl', val: values.trailLength, fmt: (v) => String(v) },
      { sliderKey: 'blendSlider', valueKey: 'blendValueEl', val: values.blend, fmt: (v) => String(v) },
      { sliderKey: 'qSlider', valueKey: 'qValueEl', val: values.q, fmt: (v) => String(v) },
      { sliderKey: 'rSlider', valueKey: 'rValueEl', val: values.r, fmt: (v) => String(v) },
    ];

    for (const { sliderKey, valueKey, val, fmt } of pairs) {
      (this.config[sliderKey] as HTMLInputElement).value = String(val);
      (this.config[valueKey] as HTMLElement).textContent = fmt(val);
    }
  }
}
