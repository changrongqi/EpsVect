import type { DataProcessorConfig } from '../processor/dataProcessor';

/**
 * 首页与子界面共用的默认滤波参数。
 *
 * M19 一致性修复：此处的值与 index.html 滑块默认值、settingsContent.ts 的 ParamDef.defaultValue 保持一致。
 * 修改任一处时必须同步全局搜索所有引用点，避免出现多源不一致的维护陷阱。
 *
 * 当前值来源（单一数据源约定）：
 * - noiseStdDev: 0        ← index.html #noise-slider value / settingsContent noise.defaultValue
 * - mincutoff:   1.0      ← index.html #mincutoff-slider value / settingsContent mincutoff.defaultValue
 * - beta:        0.007    ← index.html #beta-slider value / settingsContent beta.defaultValue
 * - blendRatio:  0.5      ← index.html #blend-slider value=50 → 50/100=0.5
 * - kalmanQ:     300      ← index.html #q-slider value / settingsContent q.defaultValue
 * - kalmanR:     30       ← index.html #r-slider value / settingsContent r.defaultValue
 */
export const HOME_PROFILE: DataProcessorConfig = {
  noiseStdDev: 0,
  mincutoff: 1.0,
  beta: 0.007,
  blendRatio: 0.5,
  kalmanQ: 300,
  kalmanR: 30,
};
