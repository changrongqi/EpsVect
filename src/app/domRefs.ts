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
    noiseSlider: document.getElementById('noise-slider') as HTMLInputElement,
    mincutoffSlider: document.getElementById('mincutoff-slider') as HTMLInputElement,
    betaSlider: document.getElementById('beta-slider') as HTMLInputElement,
    trailSlider: document.getElementById('trail-slider') as HTMLInputElement,
    blendSlider: document.getElementById('blend-slider') as HTMLInputElement,
    qSlider: document.getElementById('q-slider') as HTMLInputElement,
    rSlider: document.getElementById('r-slider') as HTMLInputElement,
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
