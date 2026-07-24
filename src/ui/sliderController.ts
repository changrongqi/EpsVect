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

      slider.addEventListener('input', () => {
        const rawValue = binding.parse(slider.value);
        valueEl.textContent = binding.format(rawValue);
        const callbackValue = binding.transform ? binding.transform(rawValue) : rawValue;
        binding.callback(callbackValue);
      });
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
    const pairs: Array<[SliderKey, number, (v: number) => string]> = [
      ['noiseValueEl', values.noise, (v) => v.toFixed(1)],
      ['mincutoffValueEl', values.mincutoff, (v) => v.toFixed(1)],
      ['betaValueEl', values.beta, (v) => v.toFixed(3)],
      ['trailValueEl', values.trailLength, (v) => String(v)],
      ['blendValueEl', values.blend, (v) => String(v)],
      ['qValueEl', values.q, (v) => String(v)],
      ['rValueEl', values.r, (v) => String(v)],
    ];

    for (const [key, val, fmt] of pairs) {
      (this.config[key] as HTMLElement).textContent = fmt(val);
    }
  }
}
