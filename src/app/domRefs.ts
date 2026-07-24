import { getElementByIdOrThrow } from './domUtils';

export interface DomRefs {
  noiseSlider: HTMLInputElement;
  mincutoffSlider: HTMLInputElement;
  betaSlider: HTMLInputElement;
  trailSlider: HTMLInputElement;
  blendSlider: HTMLInputElement;
  qSlider: HTMLInputElement;
  rSlider: HTMLInputElement;
}

export function getDomRefs(): DomRefs {
  return {
    noiseSlider: getElementByIdOrThrow<HTMLInputElement>('noise-slider'),
    mincutoffSlider: getElementByIdOrThrow<HTMLInputElement>('mincutoff-slider'),
    betaSlider: getElementByIdOrThrow<HTMLInputElement>('beta-slider'),
    trailSlider: getElementByIdOrThrow<HTMLInputElement>('trail-slider'),
    blendSlider: getElementByIdOrThrow<HTMLInputElement>('blend-slider'),
    qSlider: getElementByIdOrThrow<HTMLInputElement>('q-slider'),
    rSlider: getElementByIdOrThrow<HTMLInputElement>('r-slider'),
  };
}

export function getSliderValues(refs: DomRefs) {
  return {
    noiseStdDev: parseFloat(refs.noiseSlider.value),
    mincutoff: parseFloat(refs.mincutoffSlider.value),
    beta: parseFloat(refs.betaSlider.value),
    trailLength: parseInt(refs.trailSlider.value, 10),
    blendRatio: parseInt(refs.blendSlider.value, 10) / 100,
    kalmanQ: parseInt(refs.qSlider.value, 10),
    kalmanR: parseInt(refs.rSlider.value, 10),
  };
}
