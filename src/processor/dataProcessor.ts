/**
 * 数据处理器
 * 负责鼠标输入数据的完整处理链路：噪声注入 → 滤波 → 速度计算 → 预测坐标
 */

import { OneEuroFilter } from '@david18284/one-euro-filter';
import { createOneEuroFilter, filterCoordinate } from '../filter/oneEuroFilter';
import { KalmanFilter } from '../filter/kalmanFilter';
import { gaussianRandom } from '../util/gaussianNoise';

const PREDICTION_HORIZON_MS = 100;

export interface ProcessedData {
  noisyX: number;
  noisyY: number;
  smoothX: number;
  smoothY: number;
  speed: number;
  dx: number;
  dy: number;
  predX: number;
  predY: number;
}

export interface DataProcessorConfig {
  noiseStdDev: number;
  mincutoff: number;
  beta: number;
  kalmanQ: number;
  kalmanR: number;
  blendRatio: number;
}

export class DataProcessor {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;
  private kalman: KalmanFilter;
  private noiseStdDev: number;
  private kalmanQ: number;
  private kalmanR: number;
  private blendRatio: number;

  private prevSmoothX = 0;
  private prevSmoothY = 0;
  private prevTime = performance.now();
  private currentSpeed = 0;

  constructor(config: DataProcessorConfig) {
    this.noiseStdDev = config.noiseStdDev;
    this.kalmanQ = config.kalmanQ;
    this.kalmanR = config.kalmanR;
    this.blendRatio = config.blendRatio;
    this.filterX = createOneEuroFilter({ freq: 60, mincutoff: config.mincutoff, beta: config.beta });
    this.filterY = createOneEuroFilter({ freq: 60, mincutoff: config.mincutoff, beta: config.beta });
    this.kalman = new KalmanFilter({ dt: 16, Q: config.kalmanQ, R: config.kalmanR });
  }

  process(e: MouseEvent): ProcessedData {
    const now = performance.now();

    const noiseX = this.noiseStdDev > 0 ? gaussianRandom(0, this.noiseStdDev) : 0;
    const noiseY = this.noiseStdDev > 0 ? gaussianRandom(0, this.noiseStdDev) : 0;
    const noisyX = e.clientX + noiseX;
    const noisyY = e.clientY + noiseY;

    const smoothX = filterCoordinate(this.filterX, noisyX);
    const smoothY = filterCoordinate(this.filterY, noisyY);

    const dtSec = (now - this.prevTime) / 1000;
    const actualDtMs = Math.max(1, now - this.prevTime);

    let dx = 0;
    let dy = 0;
    if (dtSec > 0.001) {
      dx = smoothX - this.prevSmoothX;
      dy = smoothY - this.prevSmoothY;
      this.currentSpeed = Math.sqrt(dx * dx + dy * dy) / dtSec;
    }
    this.prevSmoothX = smoothX;
    this.prevSmoothY = smoothY;
    this.prevTime = now;

    this.kalman.setDt(actualDtMs);
    this.kalman.step(smoothX, smoothY);

    const vel = this.kalman.getVelocity();
    const directVx = dtSec > 0.001 ? dx / dtSec : 0;
    const directVy = dtSec > 0.001 ? dy / dtSec : 0;
    // 混合 Kalman 平滑速度与瞬时速度，比例由 blendRatio 控制
    const blendVx = vel.vx * this.blendRatio + directVx * (1 - this.blendRatio);
    const blendVy = vel.vy * this.blendRatio + directVy * (1 - this.blendRatio);
    const predX = smoothX + blendVx * PREDICTION_HORIZON_MS / 1000;
    const predY = smoothY + blendVy * PREDICTION_HORIZON_MS / 1000;

    return {
      noisyX,
      noisyY,
      smoothX,
      smoothY,
      speed: this.currentSpeed,
      dx,
      dy,
      predX,
      predY,
    };
  }

  updateNoise(value: number): void {
    this.noiseStdDev = value;
  }

  updateMincutoff(value: number): void {
    this.filterX.setMinCutoff(value);
    this.filterY.setMinCutoff(value);
  }

  updateBeta(value: number): void {
    this.filterX.setBeta(value);
    this.filterY.setBeta(value);
  }

  updateKalmanQ(value: number): void {
    this.kalmanQ = value;
    this.kalman.setQ(value);
  }

  updateKalmanR(value: number): void {
    this.kalmanR = value;
    this.kalman.setR(value);
  }

  updateBlendRatio(value: number): void {
    this.blendRatio = value;
  }

  getSpeed(): number {
    return this.currentSpeed;
  }

  getKalmanVelocity(): { vx: number; vy: number } {
    return this.kalman.getVelocity();
  }
}