/**
 * One Euro Filter 降噪层封装
 * 对原始鼠标坐标做自适应低通滤波，消除手抖和传感器噪声
 *
 * 注意：不传递 timestamp 以保持固定 60Hz 采样频率，
 * 避免因实际帧率（~240fps）导致滤波器响应过慢
 */
import { OneEuroFilter } from '@david18284/one-euro-filter';

export interface OneEuroFilterConfig {
  freq: number;
  mincutoff: number;
  beta: number;
  dcutoff: number;
}

const DEFAULT_CONFIG: OneEuroFilterConfig = {
  freq: 60,
  mincutoff: 1.0,
  beta: 0.007,
  dcutoff: 1.0,
};

export function createOneEuroFilter(config: Partial<OneEuroFilterConfig> = {}): OneEuroFilter {
  const { freq, mincutoff, beta, dcutoff } = { ...DEFAULT_CONFIG, ...config };
  return new OneEuroFilter(freq, mincutoff, beta, dcutoff);
}

export function filterCoordinate(filter: OneEuroFilter, value: number): number {
  return filter.filter(value);
}

export function reconfigureFilter(
  filter: OneEuroFilter,
  config: Partial<OneEuroFilterConfig>,
): void {
  if (config.freq !== undefined) filter.setFrequency(config.freq);
  if (config.mincutoff !== undefined) filter.setMinCutoff(config.mincutoff);
  if (config.beta !== undefined) filter.setBeta(config.beta);
  if (config.dcutoff !== undefined) filter.setDerivateCutoff(config.dcutoff);
}