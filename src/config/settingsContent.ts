/**
 * "参数设置"界面内容配置
 * 纯数据文件，修改文案/范围/默认值无需触碰渲染逻辑
 * 新增参数分组只需向数组中添加一个对象
 *
 * variant 控制分组布局变体：
 *   - standard：标准左对齐叙事 + 内嵌滑块
 *   - feature：居中窄列 + 数据锚点 + 内嵌滑块
 *
 * 每个参数含：范围、步长、默认值、算法原理说明、调参建议
 */

export type SettingsVariant = 'standard' | 'feature';

export type ParamKey = 'noise' | 'mincutoff' | 'beta' | 'trail' | 'blend' | 'q' | 'r';

export interface ParamDef {
  key: ParamKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  description: string;
  recommendation: string;
  format: (v: number) => string;
}

export interface SettingsGroup {
  id: string;
  index: string;
  title: string;
  variant: SettingsVariant;
  paragraphs: string[];
  highlights?: string[];
  params: ParamDef[];
}

export interface PresetProfile {
  id: string;
  name: string;
  description: string;
  values: Record<ParamKey, number>;
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'one-euro',
    index: '01',
    title: 'One Euro 滤波',
    variant: 'standard',
    highlights: ['自适应低通', '速度越快截止越高'],
    paragraphs: [
      'One Euro Filter 是一种自适应低通滤波器，专门用于实时信号去抖。',
      '它根据移动速度动态调整截止频率——静止时强力平滑，快速移动时几乎无延迟。',
    ],
    params: [
      {
        key: 'mincutoff',
        label: 'mincutoff',
        unit: 'Hz',
        min: 0.1,
        max: 10,
        step: 0.1,
        defaultValue: 1.0,
        description: '最小截止频率。移动速度趋近零时生效，决定静止状态的平滑程度。',
        recommendation: '追求平滑选 0.5-1.0；追求跟手选 2.0-4.0。',
        format: (v) => v.toFixed(1),
      },
      {
        key: 'beta',
        label: 'beta',
        unit: '',
        min: 0.001,
        max: 0.1,
        step: 0.001,
        defaultValue: 0.007,
        description: '速度系数。决定截止频率随速度上升的速率，越大对快速移动响应越好。',
        recommendation: '默认 0.007 适用于大多数场景；快速操作选 0.02-0.05。',
        format: (v) => v.toFixed(3),
      },
    ],
  },
  {
    id: 'kalman',
    index: '02',
    title: 'Kalman 滤波',
    variant: 'standard',
    highlights: ['4 维状态', '位置 + 速度'],
    paragraphs: [
      'Kalman Filter 维护一个包含位置和速度的 4 维状态向量，通过预测-更新循环估计真实速度。',
      'Q 与 R 的比值决定滤波器对测量值的信任程度，是调参的核心。',
    ],
    params: [
      {
        key: 'q',
        label: 'Q',
        unit: '',
        min: 1,
        max: 500,
        step: 1,
        defaultValue: 300,
        description: '过程噪声协方差。越大越信任测量值，响应越快但噪声增加。',
        recommendation: '快速跟踪选 300-500；平滑输出选 50-150。',
        format: (v) => String(v),
      },
      {
        key: 'r',
        label: 'R',
        unit: '',
        min: 10,
        max: 5000,
        step: 10,
        defaultValue: 30,
        description: '测量噪声协方差。越大越信任预测模型，输出越平滑但延迟增加。',
        recommendation: '噪声环境选 200-1000；干净信号选 20-50。',
        format: (v) => String(v),
      },
    ],
  },
  {
    id: 'blend',
    index: '03',
    title: '速度混合',
    variant: 'feature',
    highlights: ['瞬时速度', 'Kalman 速度'],
    paragraphs: [
      '最终预测速度是瞬时速度与 Kalman 估计速度的加权混合。',
      '瞬时速度响应快但噪声大，Kalman 速度平滑但有延迟——通过混合比例权衡两者。',
    ],
    params: [
      {
        key: 'blend',
        label: 'blend',
        unit: '%',
        min: 0,
        max: 100,
        step: 5,
        defaultValue: 50,
        description: 'Kalman 速度权重。0%=纯瞬时速度（跟手但抖动），100%=纯 Kalman（平滑但延迟）。',
        recommendation: '默认 50% 平衡；追求跟手降到 20-40%；追求平滑升到 70-90%。',
        format: (v) => String(v),
      },
    ],
  },
  {
    id: 'visual-test',
    index: '04',
    title: '可视化与测试',
    variant: 'standard',
    highlights: ['拖尾轨迹', '噪声注入'],
    paragraphs: [
      '拖尾长度控制鼠标轨迹的视觉残留时长，影响算法测试时的观感。',
      '噪声注入用于测试滤波器在受扰信号下的鲁棒性，正常使用时保持为 0。',
    ],
    params: [
      {
        key: 'trail',
        label: 'trail',
        unit: '点',
        min: 30,
        max: 200,
        step: 5,
        defaultValue: 100,
        description: '拖尾轨迹点数。越多轨迹越长，但渲染开销也越大。',
        recommendation: '调试细节选 150-200；流畅演示选 60-100。',
        format: (v) => String(v),
      },
      {
        key: 'noise',
        label: 'noise',
        unit: 'px',
        min: 0,
        max: 20,
        step: 0.5,
        defaultValue: 0,
        description: '高斯噪声标准差。注入到原始坐标用于测试滤波器鲁棒性，生产环境保持 0。',
        recommendation: '测试滤波效果选 2-8；正常使用保持 0。',
        format: (v) => v.toFixed(1),
      },
    ],
  },
];

export const SETTINGS_PRESETS: PresetProfile[] = [
  {
    id: 'low-latency',
    name: '低延迟',
    description: '最大化跟手性，适合快速操作',
    values: {
      mincutoff: 4.0,
      beta: 0.03,
      q: 400,
      r: 20,
      blend: 70,
      trail: 60,
      noise: 0,
    },
  },
  {
    id: 'high-stability',
    name: '高稳定',
    description: '最大化平滑度，适合精确瞄准',
    values: {
      mincutoff: 0.5,
      beta: 0.005,
      q: 100,
      r: 200,
      blend: 30,
      trail: 150,
      noise: 0,
    },
  },
  {
    id: 'balanced',
    name: '平衡',
    description: '默认推荐配置',
    values: {
      mincutoff: 1.0,
      beta: 0.007,
      q: 300,
      r: 30,
      blend: 50,
      trail: 100,
      noise: 0,
    },
  },
];
