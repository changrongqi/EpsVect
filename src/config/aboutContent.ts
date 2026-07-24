/**
 * "关于项目"叙事流内容配置
 * 纯数据文件，修改文案无需触碰渲染逻辑
 * 新增章节只需向数组中添加一个对象
 *
 * variant 控制章节布局变体：
 *   - standard：标准左对齐叙事
 *   - manifesto：居中大字宣言（用于核心理念等高潮章节）
 *   - feature：窄列 + 数据锚点（用于技术方案等含关键数据的章节）
 *
 * highlights：段落中需要高亮的关键词列表（青蓝色 + 略大字号）
 */

export type SectionVariant = 'standard' | 'manifesto' | 'feature';

export interface MetricItem {
  value: string;
  label: string;
}

export interface FlowNode {
  label: string;
  sublabel?: string;
}

/** 数学公式块：expr 为公式表达式（等宽字体居中），caption 为说明文字 */
export interface FormulaBlock {
  expr: string;
  caption?: string;
}

export interface NarrativeSection {
  id: string;
  index: string;
  title: string;
  paragraphs: string[];
  variant?: SectionVariant;
  highlights?: string[];
  metrics?: MetricItem[];
  flow?: FlowNode[];
  formulas?: FormulaBlock[];
}

export const ABOUT_SECTIONS: NarrativeSection[] = [
  {
    id: 'positioning',
    index: '01',
    title: '项目定位',
    variant: 'standard',
    highlights: ['界面主动来找你', '零点击微导航'],
    paragraphs: [
      'EpsVect 是一个创新的人机交互实验项目，重新思考人类如何导航数字界面。',
      '它持续读取手腕的细微方向变化——在最初几像素的移动中预测意图——然后让界面向你正在前往的方向倾斜、缩放和高亮。',
      '界面主动来找你，而不是你去找界面。',
    ],
  },
  {
    id: 'problem',
    index: '02',
    title: '解决的问题',
    variant: 'standard',
    highlights: ['Fitts\'s Law', '认知负担'],
    paragraphs: [
      '当今的 UI 导航依赖精确的光标定位（Fitts\'s Law）、长距离拖动和视觉搜索。',
      '在密集的仪表盘和多面板布局中，这种方式缓慢、疲劳，且认知负担沉重。',
      '用户必须精确瞄准目标、执行完整的拖动手势、在视觉噪声中搜索——每一步都在消耗注意力。',
    ],
  },
  {
    id: 'concept',
    index: '03',
    title: '核心理念',
    variant: 'manifesto',
    highlights: ['方向即意图', '界面即响应'],
    paragraphs: [
      '手腕的一次轻拂就携带了意图。3 像素的移动已经告诉你用户想去哪里——只要你足够仔细地倾听。',
      'EpsVect 将方向本身作为输入，而非位置的附属品。',
      '方向即意图，界面即响应。',
    ],
  },
  {
    id: 'technology',
    index: '04',
    title: '技术方案',
    variant: 'feature',
    highlights: ['One Euro Filter', 'Kalman Filter', '50ms'],
    paragraphs: [
      '自适应 One Euro Filter 消除亚像素级抖动，经过调优的 Kalman Filter 实现基于速度的方向预测。',
      '两者结合在 50ms 内解码意图，然后驱动 UI 向目标方向弯曲。',
      '所有参数——滤波平滑度、预测视界、UI 响应曲线——均向设计者开放，而非仅限工程师。',
    ],
    metrics: [
      { value: '50ms', label: '意图解码延迟' },
      { value: '3px', label: '微导航阈值' },
    ],
    flow: [
      { label: 'One Euro', sublabel: '亚像素降噪' },
      { label: 'Kalman', sublabel: '速度预测' },
      { label: '意图', sublabel: '驱动 UI' },
    ],
  },
  {
    id: 'status',
    index: '05',
    title: '项目状态',
    variant: 'standard',
    highlights: ['研究原型', '生产就绪'],
    paragraphs: [
      'EpsVect 既是一个研究原型，也是一个生产就绪的库。',
      '包含高频信号管线、渲染层和完整的调试工具包：冻结检查、滑动窗口质量指标、历史记录器、JSON/CSV 导出。',
      '用于设计和调优意图感知界面。',
    ],
  },
];
