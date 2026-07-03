declare module '@david18284/one-euro-filter' {
  export class LowPassFilter {
    constructor(alpha: number, initval?: number);
    setAlpha(alpha: number): void;
    filter(value: number): number;
    filterWithAlpha(value: number, alpha: number): number;
    hasLastRawValue(): boolean;
    lastRawValue(): number;
    reset(): void;
  }

  export class OneEuroFilter {
    constructor(
      freq: number,
      mincutoff?: number,
      beta?: number,
      dcutoff?: number,
    );
    filter(value: number, timestamp?: number): number;
    reset(): void;
    setFrequency(f: number): void;
    setMinCutoff(mc: number): void;
    setBeta(b: number): void;
    setDerivateCutoff(dc: number): void;
  }
}