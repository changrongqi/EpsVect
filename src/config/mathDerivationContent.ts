/**
 * "数学推导"叙事流内容配置
 * 纯数据文件，基于项目实际算法实现提炼
 * 复用 NarrativeSection 类型（含扩展的 formulas 字段），由 NarrativeRenderer 渲染
 *
 * 章节布局策略：
 *   01 问题建模     - standard   引入噪声与意图的数学描述
 *   02 One Euro     - feature    自适应低通滤波推导，含截止频率公式
 *   03 Kalman       - feature    状态空间模型与预测-更新方程，含矩阵公式
 *   04 置信度       - feature    速度因子与稳定性因子乘积模型
 *   05 倾向计算     - feature    对齐度与 EMA 平滑，含阈值方程
 *   06 误差权衡     - manifesto  Q/R 权衡的工程哲学结语
 */

import type { NarrativeSection } from './aboutContent';

export const MATH_SECTIONS: NarrativeSection[] = [
  {
    id: 'modeling',
    index: '01',
    title: '问题建模',
    variant: 'standard',
    highlights: ['观测模型', '真实意图', '高斯噪声'],
    paragraphs: [
      '将鼠标移动建模为带噪声的观测序列：传感器读数 zₜ 是真实意图 xₜ 与高斯噪声 ε 的叠加。',
      '目标是：从带噪观测序列 {z₀, z₁, ..., zₜ} 中实时估计真实位置 xₜ、速度 vₜ，并外推预测未来位置 x̂ₜ₊Δ。',
      '这同时是一个滤波问题（去噪）与预测问题（外推），需要兼顾平滑度与响应速度。',
    ],
    formulas: [
      {
        expr: 'zₜ = xₜ + ε,    ε ~ 𝒩(0, σ²)',
        caption: '观测模型：读数 = 真实位置 + 高斯噪声',
      },
      {
        expr: 'x̂ₜ₊Δ = xₜ + vₜ · Δ',
        caption: '预测模型：基于当前速度外推 Δ 时刻后的位置',
      },
    ],
  },
  {
    id: 'one-euro',
    index: '02',
    title: 'One Euro Filter',
    variant: 'feature',
    highlights: ['自适应截止频率', 'mincutoff', 'beta'],
    paragraphs: [
      'One Euro Filter 的核心思想：速度越快，截止频率越高，保留更多高频细节；速度越慢，截止频率越低，滤除更多手抖噪声。',
      '它仅需两个参数：mincutoff 控制静止时的平滑度，beta 控制速度对截止频率的影响强度。',
      '项目中对 X/Y 轴分别建立独立滤波器，固定 60Hz 采样频率以避免帧率波动导致的响应不一致。',
    ],
    formulas: [
      {
        expr: 'fc = mincutoff + beta · |v̂|',
        caption: '截止频率：随速度幅值线性增长',
      },
      {
        expr: 'α = 1 / (1 + τ · 2π · fc),    τ = 1 / freq',
        caption: 'EMA 系数：由截止频率与采样周期推导',
      },
      {
        expr: 'x̂ₜ = α · zₜ + (1 − α) · x̂ₜ₋₁',
        caption: '滤波输出：一阶低通',
      },
    ],
    metrics: [
      { value: '60Hz', label: '采样频率' },
      { value: '1.0', label: 'mincutoff 默认' },
      { value: '0.007', label: 'beta 默认' },
    ],
  },
  {
    id: 'kalman',
    index: '03',
    title: 'Kalman Filter',
    variant: 'feature',
    highlights: ['状态向量', '预测-更新', '卡尔曼增益'],
    paragraphs: [
      'Kalman Filter 以 [x, y, vx, vy] 为状态向量，构建匀速运动模型。状态转移矩阵 A 编码位置-速度的线性关系。',
      '算法分两步循环：预测步用 A 外推状态与协方差，更新步用观测值通过卡尔曼增益 K 修正预测。',
      '增益 K 由预测协方差 P 与测量噪声 R 的相对大小决定——P 越大越信任观测，R 越大越信任预测。',
    ],
    formulas: [
      {
        expr: 'xₜ = [x, y, vx, vy]ᵀ',
        caption: '状态向量：位置 + 速度',
      },
      {
        expr: 'A = [[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]]',
        caption: '状态转移矩阵：匀速运动假设',
      },
      {
        expr: 'x̂₋ = A · x̂,    P₋ = A · P · Aᵀ + Q',
        caption: '预测步：状态与协方差外推',
      },
      {
        expr: 'K = P₋ · Hᵀ · (H · P₋ · Hᵀ + R)⁻¹',
        caption: '卡尔曼增益：预测与观测的信任权衡',
      },
      {
        expr: 'x̂ = x̂₋ + K · (z − H · x̂₋)',
        caption: '更新步：用观测残差修正预测',
      },
    ],
    flow: [
      { label: '预测', sublabel: 'project()' },
      { label: '残差', sublabel: 'z − H·x̂₋' },
      { label: '增益', sublabel: 'K' },
      { label: '更新', sublabel: 'x̂ = x̂₋ + K·y' },
    ],
  },
  {
    id: 'confidence',
    index: '04',
    title: '置信度计算',
    variant: 'feature',
    highlights: ['速度因子', '稳定性因子', 'EMA 平滑'],
    paragraphs: [
      '置信度衡量当前预测的可信程度，由速度因子与稳定性因子相乘得到。',
      '速度因子：速度过低时置信度趋零（难以分辨意图），速度过高时置信度饱和。',
      '稳定性因子：基于最近 10 个方向角的圆标准差——方向越一致，置信度越高。',
    ],
    formulas: [
      {
        expr: 'speedFactor = clamp((speed − 5) / 100, 0, 1) · 0.6 + extra',
        caption: '速度因子：低于 5px/s 视为静止',
      },
      {
        expr: 'stability = max(0.3, 1 − (σ_θ − 3°) / 40°)',
        caption: '稳定性因子：圆标准差越小越稳定',
      },
      {
        expr: 'confidence = EMA(rawConfidence, 0.3)',
        caption: 'EMA 平滑：0.3 新值 + 0.7 旧值',
      },
    ],
    metrics: [
      { value: '5px/s', label: '静止阈值' },
      { value: '10', label: '历史窗口' },
      { value: '0.3', label: 'EMA α' },
    ],
  },
  {
    id: 'tendency',
    index: '05',
    title: '倾向计算',
    variant: 'feature',
    highlights: ['对齐度', 'EMA 平滑', '迟滞阈值'],
    paragraphs: [
      '倾向值衡量用户意图指向某一按钮的强度。核心是预测方向与目标方向的余弦对齐度。',
      '距离衰减因子让远处按钮的对齐度被削弱，避免误判。最终倾向值经 EMA 平滑（0.85/0.15）实现渐进式稳定变化。',
      '迟滞阈值机制：触发高亮需 > 0.15，取消高亮需 < 0.06，避免临界状态闪烁。',
    ],
    formulas: [
      {
        expr: 'alignment = max(0, cos(θ̂ − θ_target))',
        caption: '对齐度：预测方向与目标方向的余弦',
      },
      {
        expr: 'distanceFactor = max(0.3, 1 − dist / maxDist)',
        caption: '距离衰减：远处按钮的权重削弱',
      },
      {
        expr: 'tendency = 0.85 · tendency + 0.15 · (alignment · distanceFactor)',
        caption: 'EMA 平滑：渐进式稳定',
      },
      {
        expr: 'highlight: on > 0.15,    off < 0.06',
        caption: '迟滞阈值：防止状态闪烁',
      },
    ],
    flow: [
      { label: '预测方向', sublabel: 'θ̂ = atan2(vy, vx)' },
      { label: '对齐度', sublabel: 'cos(Δθ)' },
      { label: 'EMA', sublabel: '0.85 / 0.15' },
      { label: '高亮判定', sublabel: '迟滞阈值' },
    ],
  },
  {
    id: 'tradeoff',
    index: '06',
    title: '误差权衡',
    variant: 'manifesto',
    highlights: ['Q 与 R', '平滑与响应'],
    paragraphs: [
      '滤波器的本质，是在平滑与响应之间寻找平衡。',
      'Q 越大，越信任观测，响应越快但越抖动；R 越大，越信任预测，越平滑但越滞后。',
      '没有最优参数，只有最适合场景的权衡——这正是 EpsVect 将参数向设计者开放的初衷。',
    ],
  },
];
