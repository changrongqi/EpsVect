import type { DataProcessorConfig } from '../processor/dataProcessor';

export const HOME_PROFILE: DataProcessorConfig = {
  noiseStdDev: 0,
  mincutoff: 1.0,
  beta: 0.01,
  blendRatio: 0.6,
  kalmanQ: 200,
  kalmanR: 50,
};
