/**
 * "源代码"叙事流内容配置
 * 纯数据文件，基于 CODE_WIKI.md 提炼
 * 复用 NarrativeSection 类型，由 NarrativeRenderer 渲染
 *
 * 章节布局策略：
 *   01 项目概览   - standard   引言式开场
 *   02 五层架构   - feature    含分层 flow 数据锚点
 *   03 数据流管线 - feature    含处理链路 flow
 *   04 核心算法   - feature    含关键指标 metrics
 *   05 关键模块   - standard   模块职责说明
 *   06 扩展指南   - manifesto  结语宣言
 */

import type { NarrativeSection } from './aboutContent';

export const SOURCE_CODE_SECTIONS: NarrativeSection[] = [
  {
    id: 'overview',
    index: '01',
    title: '项目概览',
    variant: 'standard',
    highlights: ['TypeScript', 'Vite', 'One Euro Filter', 'Kalman Filter'],
    paragraphs: [
      'EpsVect 是一个用 TypeScript 编写的人机交互实验项目，基于 Vite 构建，核心由 One Euro Filter 与 Kalman Filter 双层架构驱动。',
      '它从极小的鼠标运动向量变化中读懂用户意图，在 50ms 内解码方向，然后让界面向预测方向倾斜、缩放和高亮。',
      '整个项目按单一职责原则拆分为五层：应用入口、核心控制、数据处理、渲染、工具，共 40 余个模块。',
    ],
  },
  {
    id: 'architecture',
    index: '02',
    title: '五层架构',
    variant: 'feature',
    highlights: ['单一职责', '五层架构'],
    paragraphs: [
      '项目采用严格的分层架构，每一层只与相邻层通信，杜绝跨层耦合。',
      'UI 层负责视图与交互，核心控制层协调倾向与调度，数据处理层执行滤波与检测，渲染层绘制星空与轨迹，工具层提供通用数学与缓冲能力。',
    ],
    metrics: [
      { value: '5', label: '架构层数' },
      { value: '40+', label: '模块数量' },
    ],
    flow: [
      { label: 'UI 层', sublabel: '视图/交互' },
      { label: '核心控制', sublabel: '倾向/调度' },
      { label: '数据处理', sublabel: '滤波/检测' },
      { label: '渲染', sublabel: '星空/轨迹' },
      { label: '工具', sublabel: '数学/缓冲' },
    ],
  },
  {
    id: 'pipeline',
    index: '03',
    title: '数据流管线',
    variant: 'feature',
    highlights: ['DataProcessor', 'MousePipeline', '50ms'],
    paragraphs: [
      '鼠标事件首先进入 DataProcessor，依次经过噪声注入、One Euro 滤波、速度计算、Kalman 状态估计、速度混合与坐标预测六步处理。',
      '随后 MousePipeline 将结果分发给方向检测器、置信度计算器、漂移检测器与统计收集器，完成完整的意图解析链路。',
    ],
    metrics: [
      { value: '6 步', label: '数据处理' },
      { value: '4 路', label: '并行检测' },
    ],
    flow: [
      { label: '噪声注入', sublabel: '高斯噪声' },
      { label: 'One Euro', sublabel: '自适应滤波' },
      { label: 'Kalman', sublabel: '状态估计' },
      { label: '预测', sublabel: '坐标外推' },
    ],
  },
  {
    id: 'algorithm',
    index: '04',
    title: '核心算法',
    variant: 'feature',
    highlights: ['One Euro Filter', 'Kalman Filter', 'EMA'],
    paragraphs: [
      'One Euro Filter 根据速度自适应调整截止频率——慢速时强滤波消除手抖，快速时弱滤波保持跟手，仅需 mincutoff 与 beta 两个参数。',
      'Kalman Filter 以 [x, y, vx, vy] 为状态向量，通过预测-更新两步循环实现速度平滑与坐标外推，Q 与 R 控制响应与稳定的权衡。',
      '倾向计算采用 EMA 平滑（0.85/0.15）与迟滞阈值（触发 0.15 / 取消 0.06），避免按钮高亮在临界状态频繁闪烁。',
    ],
    metrics: [
      { value: '100ms', label: '预测视界' },
      { value: '0.15', label: '高亮阈值' },
      { value: '500ms', label: '锁定时长' },
    ],
    flow: [
      { label: '预测方向', sublabel: 'atan2(vy, vx)' },
      { label: '对齐度', sublabel: 'cos(Δθ)' },
      { label: 'EMA', sublabel: '倾向平滑' },
      { label: '高亮', sublabel: '阈值判定' },
    ],
  },
  {
    id: 'modules',
    index: '05',
    title: '关键模块',
    variant: 'standard',
    highlights: ['TendencyController', 'ActionTendencyController', 'AppScheduler'],
    paragraphs: [
      'TendencyController 是意图分发的中枢——主页模式下计算入口倾向并驱动星空色彩，子界面模式下委托给 ActionTendencyController 计算按钮高亮。',
      'AppScheduler 以 requestAnimationFrame 驱动整个动画循环，负责 FPS 计数、漂移计算、静止检测、面板刷新与倾向更新，是所有周期性任务的统一调度入口。',
      '渲染层由 Canvas 主入口、星空背景、轨迹缓冲与入口渲染器协作完成，入口渲染器使用鱼眼投影将文字散布在天穹内壁，营造仰望星空的空间感。',
    ],
  },
  {
    id: 'extension',
    index: '06',
    title: '扩展指南',
    variant: 'manifesto',
    highlights: ['单一职责', '可扩展'],
    paragraphs: [
      '添加子界面只需三步：HTML 建容器、bootstrap 注册视图、配置章节数据交由 NarrativeRenderer 渲染。',
      '添加按钮算法功能只需一个属性：data-action-id，系统会自动将其纳入倾向计算与高亮体系。',
      '架构的优雅，在于让复杂的能力以最简单的方式被复用。',
    ],
  },
];
