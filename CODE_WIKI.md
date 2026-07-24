# EpsVect Code Wiki

> **项目全称**: EpsVect — 前端实时鼠标动向高精度预测系统
> **版本**: v0.1.0
> **技术栈**: TypeScript + Vite + Canvas 2D
> **核心算法**: One Euro Filter + Kalman Filter

---

## 目录

1. [项目概述](#1-项目概述)
2. [架构设计](#2-架构设计)
3. [模块详细说明](#3-模块详细说明)
4. [核心算法流程](#4-核心算法流程)
5. [依赖关系](#5-依赖关系)
6. [项目运行与调试](#6-项目运行与调试)
7. [扩展指南](#7-扩展指南)

---

## 1. 项目概述

### 1.1 项目定位

EpsVect 是一个创新的 HCI（人机交互）实验项目，重新思考人类如何导航数字界面。核心理念是：**从极小的鼠标运动向量变化中读懂用户意图**，实现"零点击微导航"。

### 1.2 核心能力

| 能力 | 描述 |
|------|------|
| **亚像素级降噪** | 使用 One Euro Filter 消除手抖和传感器噪声 |
| **速度基方向预测** | 结合 Kalman Filter 实现基于速度的方向预测 |
| **意图解码** | 在 50ms 内解码用户意图 |
| **UI 动态响应** | 界面向预测方向倾斜、缩放和高亮 |
| **多视图导航** | 基于方向意图的视图切换 |

### 1.3 问题解决

传统 UI 导航存在的问题：
- 精确目标定位需求（Fitts's Law）
- 长距离拖动手势
- 视觉搜索负担

EpsVect 的解决方案：
- 微小手腕移动即可切换标签/面板
- UI 主动向预测方向倾斜和发光
- 亚像素级精度处理噪声输入

---

## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户界面层 (UI)                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ViewSwitcher│ │PanelRenderer│ │SliderCtrl│ │FreezeController   │ │
│  └──────────┘  └───────────┘  └──────────┘  └───────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                        核心控制层 (Core)                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │ TendencyController│ │ActionTendencyCtrl│ │MouseHandler     │   │
│  ├──────────────────┤  ├──────────────────┤  ├─────────────────┤   │
│  │ TendencyEngine   │ │ActionTendency    │ │AppScheduler     │   │
│  │ EntryTendency    │ │EntryTendency     │ │MousePipeline    │   │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                        数据处理层 (Processor/Detector)              │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │ DataProcessor│ │DirectionDetector│ │ConfidenceCalculator  │   │
│  ├──────────────┤  ├────────────────┤  ├──────────────────────┤   │
│  │ OneEuroFilter│ │DriftDetector   │ │StatsCollector        │   │
│  │ KalmanFilter │ └────────────────┘ └──────────────────────┘   │
│  └──────────────┘                    ┌──────────────────────┐   │
│                                       │HistoryRecorder      │   │
│                                       │QualityAnalyzer      │   │
│                                       └──────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                        渲染层 (Renderer)                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │    Canvas  │ │   Starry   │ │ TrailBuffer│ │EntryRenderer │  │
│  ├────────────┤  ├────────────┤  ├────────────┤  ├─────────────┤  │
│  │ TrailRender│ │ StarFactory│ │ StarRender │ │              │  │
│  └────────────┘  └────────────┘  └────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        工具层 (Math/Util)                           │
│  ┌─────────────┐  ┌───────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ angleUtils  │ │ matrix4   │ │ ringBuffer  │ │gaussianNoise│  │
│  └─────────────┘  └───────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
鼠标事件 → MouseHandler → MousePipeline → 处理结果
     │              │              │
     │              │              ├──→ DataProcessor (噪声→滤波→速度→预测)
     │              │              ├──→ DirectionDetector (方向检测)
     │              │              ├──→ ConfidenceCalculator (置信度)
     │              │              ├──→ DriftDetector (漂移检测)
     │              │              └──→ StatsCollector (统计)
     │              │
     │              ├──→ 面板更新 (PanelRenderer)
     │              ├──→ 轨迹渲染 (TrailRenderer)
     │              └──→ 历史记录 (HistoryRecorder)
     │
     └──→ AppScheduler (动画循环/静止检测/倾向更新)
```

### 2.3 目录结构

```
src/
├── app/                 # 应用入口与初始化
│   ├── bootstrap.ts     # 应用启动配置
│   ├── appContext.ts    # 应用上下文接口
│   ├── domRefs.ts       # DOM 引用获取
│   └── eventBindings.ts # 全局事件绑定
├── config/              # 配置文件
│   ├── entryConfig.ts   # 入口配置
│   └── profileConfig.ts # 配置预设
├── core/                # 核心控制逻辑
│   ├── pipeline.ts      # 数据处理管线
│   ├── mouseHandler.ts  # 鼠标事件处理
│   ├── appScheduler.ts  # 应用调度器
│   ├── tendency.ts      # 倾向引擎
│   ├── tendencyController.ts    # 倾向控制器
│   ├── actionTendency.ts        # 动作倾向计算
│   ├── actionTendencyController.ts # 动作倾向控制器
│   └── entryTendency.ts # 入口倾向计算
├── processor/           # 数据处理器
│   └── dataProcessor.ts # 完整数据处理链路
├── detector/            # 检测器
│   ├── directionDetector.ts     # 方向检测器
│   ├── confidenceCalculator.ts  # 置信度计算器
│   └── driftDetector.ts # 漂移检测器
├── filter/              # 滤波器
│   ├── oneEuroFilter.ts # One Euro Filter 封装
│   └── kalmanFilter.ts  # Kalman Filter 实现
├── renderer/            # 渲染模块
│   ├── canvas.ts        # Canvas 渲染器主入口
│   ├── starry.ts        # 星空背景
│   ├── starFactory.ts   # 星星生成器
│   ├── starRenderer.ts  # 星星渲染器
│   ├── trailBuffer.ts   # 轨迹缓冲区
│   ├── trailRenderer.ts # 轨迹渲染器
│   └── entryRenderer.ts # 入口渲染器
├── ui/                  # UI 组件
│   ├── viewSwitcher.ts  # 视图切换器
│   ├── panelRenderer.ts # 信息面板渲染
│   ├── sliderController.ts      # 滑块控制器
│   └── freezeController.ts      # 冻结控制器
├── debug/               # 调试工具
│   ├── statsCollector.ts        # 统计收集器
│   ├── historyRecorder.ts       # 历史记录器
│   ├── qualityAnalyzer.ts       # 质量分析器
│   └── fileExporter.ts  # 文件导出器
├── math/                # 数学工具
│   ├── angleUtils.ts    # 角度计算工具
│   └── matrix4.ts       # 矩阵运算工具
├── util/                # 通用工具
│   ├── ringBuffer.ts    # 环形缓冲区
│   ├── fpsCounter.ts    # FPS 计数器
│   └── gaussianNoise.ts # 高斯噪声生成
├── types/               # 类型声明
│   └── one-euro-filter.d.ts     # 外部模块类型
├── main.ts              # 应用入口
└── style.css            # 全局样式
```

---

## 3. 模块详细说明

### 3.1 应用入口层 (app/)

#### 3.1.1 main.ts

**职责**: 应用入口，初始化 DOM 引用并启动应用

```typescript
import { getDomRefs } from './app/domRefs';
import { bootstrapApp } from './app/bootstrap';

function main(): void {
  const refs = getDomRefs();
  bootstrapApp(refs);
}
main();
```

#### 3.1.2 bootstrap.ts

**职责**: 应用启动配置中心，负责创建所有核心模块并建立依赖关系

**关键函数**:
- `createCoreProcessors()` - 创建数据处理管线相关模块
- `createViewSwitcher()` - 创建视图切换器并注册所有视图
- `createUIControllers()` - 创建 UI 控制器（滑块、冻结、面板）
- `setupViewSwitcherCallbacks()` - 配置视图切换回调
- `bootstrapApp()` - 主启动函数，组合所有模块

**模块初始化顺序**:
1. 初始化渲染器 (`initRenderer`, `initStarryBackground`)
2. 创建核心处理器 (`createCoreProcessors`)
3. 创建视图切换器 (`createViewSwitcher`)
4. 创建 UI 控制器 (`createUIControllers`)
5. 创建倾向控制器 (`TendencyController`)
6. 配置视图切换回调 (`setupViewSwitcherCallbacks`)
7. 创建调度器 (`AppScheduler`)
8. 创建鼠标处理器 (`MouseHandler`)
9. 绑定全局事件 (`bindGlobalEvents`)
10. 启动调度器 (`scheduler.start()`)

#### 3.1.3 appContext.ts

**职责**: 定义应用上下文接口，聚合所有核心模块引用

```typescript
export interface AppContext {
  dataProcessor: DataProcessor;
  directionDetector: DirectionDetector;
  confidenceCalculator: ConfidenceCalculator;
  driftDetector: DriftDetector;
  statsCollector: StatsCollector;
  historyRecorder: HistoryRecorder;
  qualityAnalyzer: QualityAnalyzer;
  pipeline: MousePipeline;
  tendencyEngine: TendencyEngine;
  viewSwitcher: ViewSwitcher;
  tendencyController: TendencyController;
  mouseHandler: MouseHandler;
  scheduler: AppScheduler;
  sliderController: SliderController;
  freezeController: FreezeController;
  panelRenderer: PanelRenderer;
}
```

#### 3.1.4 domRefs.ts

**职责**: 获取并管理 DOM 元素引用

**接口**:
- `DomRefs` - 滑块 DOM 引用集合
- `getDomRefs()` - 获取所有滑块引用
- `getSliderValues()` - 读取所有滑块当前值

#### 3.1.5 eventBindings.ts

**职责**: 绑定全局事件处理器

**事件处理**:
- `mousemove` → 调度器更新 + 鼠标处理器
- `click` → 主页入口点击或子界面按钮触发
- `keydown(Space)` → 冻结/解冻面板
- `.back-btn click` → 返回主页

---

### 3.2 核心控制层 (core/)

#### 3.2.1 pipeline.ts

**职责**: 鼠标管线处理器，封装完整数据处理流程

**接口**:
```typescript
export interface PipelineResult {
  noisy: { x: number; y: number };       // 噪声坐标
  smooth: { x: number; y: number };      // 平滑坐标
  prediction: {                          // 预测数据
    fromX, fromY, vx, vy, predX, predY, confidence, speed
  };
  panelData: PanelUpdateData;            // 面板更新数据
  speed: number;                         // 当前速度
  lagDeg: number;                        // 方向延迟
  confidence: number;                    // 当前置信度
  predError: number;                     // 预测误差
  historyEntry: Omit<HistoryEntry, 'timestamp'>;
}
```

**处理流程**:
1. 数据处理器处理原始坐标
2. 方向检测器进行微窗口方向检测
3. 置信度计算器根据方向一致性计算置信度
4. 漂移检测器记录静止时的坐标漂移
5. 统计收集器记录数据并计算预测误差

#### 3.2.2 mouseHandler.ts

**职责**: 鼠标事件处理器，管理鼠标移动事件的响应

**关键配置**:
- `PANEL_UPDATE_MS = 30` - 面板更新节流时间（约 33 次/秒）

**处理逻辑**:
- 调用管线处理鼠标事件
- 更新轨迹渲染（非主页模式）
- 节流更新信息面板
- 记录历史数据（非主页模式）

#### 3.2.3 appScheduler.ts

**职责**: 应用调度器，管理动画循环和周期性任务

**关键配置**:
- `STATS_REFRESH_MS = 500` - 统计数据刷新间隔
- `KPI_REFRESH_MS = 3000` - KPI 刷新间隔
- `PANEL_UPDATE_MS = 30` - 面板更新间隔

**动画循环职责**:
1. FPS 计数
2. 漂移计算
3. 面板统计更新
4. 静止检测（16ms 阈值）
5. 星空视差更新
6. 倾向更新（通过 `onExtraUpdate` 回调）
7. 统计面板更新（每 500ms）
8. KPI 更新（每 3000ms）
9. Canvas 渲染

#### 3.2.4 tendency.ts

**职责**: 倾向引擎，计算用户意图倾向值

**核心算法**:
```typescript
// 倾向值更新公式
if (alignment > 0.02) {
  tendency += k * alignment * (1 + tendency) * dt;
} else {
  tendency -= decay * tendency * dt;
}
// 倾向值范围 [0, 1]
```

**属性**:
- `tendency` - 倾向强度（0-1）
- `direction` - 目标方向角度
- `alignment` - 当前方向与目标方向的对齐度

#### 3.2.5 tendencyController.ts

**职责**: 倾向控制器，协调入口倾向计算和星空倾向同步

**两种工作模式**:
- **主页模式**: 计算入口倾向，更新星空倾向效果
- **子界面模式**: 委托给 `ActionTendencyController`

**关键方法**:
- `update()` - 根据当前视图模式执行不同更新逻辑
- `reset()` - 重置倾向状态（界面切换时调用）

#### 3.2.6 actionTendency.ts

**职责**: 动作倾向计算，为子界面按钮计算倾向值

**核心公式**:
```typescript
// 倾向值 = cos(Δθ) × 距离衰减因子
const alignment = Math.max(0, Math.cos(predictedTheta - targetTheta));
const distanceFactor = Math.max(0.3, 1 - dist / maxDistance);
const weightedAlignment = alignment * distanceFactor;
// EMA 平滑
tendency = tendency * EMA_DECAY(0.85) + weightedAlignment * EMA_ALPHA(0.15);
```

**关键配置**:
- `HIGHLIGHT_THRESHOLD = 0.15` - 按钮高亮阈值
- `MIN_TENDENCY = 0.01` - 最小倾向值（低于此值清零）

#### 3.2.7 actionTendencyController.ts

**职责**: 动作倾向控制器，管理子界面按钮的倾向计算和高亮

**核心功能**:
1. 视图注册/注销
2. 定时刷新按钮位置（每 1 秒）
3. 倾向更新与高亮应用
4. 获取当前激活按钮 ID

#### 3.2.8 entryTendency.ts

**职责**: 多入口倾向计算器，为主页入口计算倾向值

**特性**:
- EMA 平滑倾向值
- 锁定机制防止快速切换（500ms 锁定时长）
- 支持多入口独立计算

---

### 3.3 数据处理层 (processor/)

#### 3.3.1 dataProcessor.ts

**职责**: 数据处理器，完整处理链路：噪声注入 → 滤波 → 速度计算 → 预测

**处理流程**:
1. **噪声注入**: 可选地叠加高斯噪声用于测试
2. **One Euro Filter**: 自适应低通滤波消除噪声
3. **速度计算**: 基于帧间隔计算瞬时速度
4. **Kalman Filter**: 状态估计与速度平滑
5. **速度混合**: 混合 Kalman 速度与瞬时速度
6. **预测坐标**: 根据混合速度预测未来位置

**接口**:
```typescript
export interface ProcessedData {
  noisyX, noisyY: number;      // 噪声坐标
  smoothX, smoothY: number;    // 平滑坐标
  speed: number;               // 当前速度 (px/s)
  dx, dy: number;              // 帧间位移
  vx, vy: number;              // 混合速度
  predX, predY: number;        // 预测坐标
}
```

**配置参数**:
- `noiseStdDev` - 噪声标准差
- `mincutoff` - One Euro Filter 最小截止频率
- `beta` - One Euro Filter 速度系数
- `kalmanQ` - Kalman 过程噪声协方差
- `kalmanR` - Kalman 测量噪声协方差
- `blendRatio` - Kalman/瞬时速度混合比例

---

### 3.4 检测器层 (detector/)

#### 3.4.1 directionDetector.ts

**职责**: 方向检测器，根据速度和位移计算移动方向

**检测状态**:
| 速度范围 | 状态标签 | 方向计算方式 |
|----------|----------|--------------|
| < 5 px/s | `still` | 静止 |
| 5-50 px/s | `micro` | 微窗口（5点）方向 |
| 50-200 px/s | `slow` | 瞬时方向 |
| 200-500 px/s | `medium` | 瞬时方向 |
| >= 500 px/s | `fast` | 瞬时方向 |
| 变向时 | `turning` | 直接更新平滑方向 |

**平滑算法**:
- 使用 EMA 角度平滑（`emaAngle`）
- 速度越快，平滑系数越大（alpha: 0.5 → 0.9）
- 方向突变超过 30° 且速度 > 20 时直接跳转

#### 3.4.2 confidenceCalculator.ts

**职责**: 置信度计算器，根据方向一致性计算预测置信度

**计算方法**:
```typescript
// 速度因子：速度越高置信度越高
speedFactor = min(1, max(0, (speed - 5) / 100)) * 0.6 + ...

// 稳定性因子：方向越一致置信度越高
stdAngle = circularStdDev(thetaHistory)
stabilityFactor = max(0.3, min(1, 1 - (stdAngleDeg - 3) / 40))

// 最终置信度（EMA 平滑）
rawConfidence = speedFactor * stabilityFactor
smoothedConfidence = 0.3 * rawConfidence + 0.7 * smoothedConfidence
```

#### 3.4.3 driftDetector.ts

**职责**: 漂移检测器，检测鼠标静止时的坐标漂移

**算法**:
1. 收集静止时的坐标点（最多 120 点）
2. 计算所有点的平均值
3. 计算每个点到平均值的最大距离作为漂移值

---

### 3.5 滤波器层 (filter/)

#### 3.5.1 oneEuroFilter.ts

**职责**: One Euro Filter 封装，对坐标进行自适应低通滤波

**核心特性**:
- 自适应截止频率，根据速度动态调整
- 消除高频噪声（手抖）同时保持快速响应
- 使用外部 npm 包 `@david18284/one-euro-filter`

**配置参数**:
- `freq` - 采样频率（默认 60Hz）
- `mincutoff` - 最小截止频率（默认 1.0）
- `beta` - 速度系数（默认 0.007）
- `dcutoff` - 导数截止频率（默认 1.0）

#### 3.5.2 kalmanFilter.ts

**职责**: Kalman Filter 实现，用于状态估计和速度平滑

**状态向量**: `[x, y, vx, vy]`

**核心矩阵**:
- **状态转移矩阵 A**: `[[1,0,dt,0],[0,1,0,dt],[0,0,1,0],[0,0,0,1]]`
- **观测矩阵 H**: `[[1,0,0,0],[0,1,0,0]]`
- **过程噪声 Q**: 对角矩阵
- **测量噪声 R**: 对角矩阵

**算法步骤**:
1. **预测** (`project()`): 基于状态转移矩阵预测下一状态
2. **更新** (`update()`): 使用观测值修正预测状态

---

### 3.6 渲染层 (renderer/)

#### 3.6.1 canvas.ts

**职责**: Canvas 渲染器主入口，管理轨迹缓冲区和渲染状态

**视图模式**:
- `home` - 主页模式：渲染入口文字
- `algo-test` - 算法测试模式：渲染轨迹和预测箭头
- `sub` - 子界面模式：不渲染

**关键函数**:
- `initRenderer()` - 初始化渲染器
- `pushTrailPoint()` - 推送轨迹点
- `setPrediction()` - 设置预测数据
- `setEntries()` - 设置入口数据
- `renderFrame()` - 渲染一帧

#### 3.6.2 starry.ts

**职责**: 星空背景渲染器，实现视差滚动和倾向效果

**单例模式**: 通过 `initStarryBackground()` 创建全局实例

**核心功能**:
- 三层深度星星渲染（近/中/远）
- 鼠标方向视差效果
- 倾向方向色彩变化
- 主页/算法模式切换

**关键函数**:
- `setParallax()` - 设置视差偏移
- `setTendency()` - 设置倾向效果
- `setHomeMode()` - 切换主页模式

#### 3.6.3 starFactory.ts

**职责**: 星星生成器，创建不同深度和颜色的星星

**星星属性**:
- `depth` - 深度级别（0/1/2，对应远/中/近）
- `radius` - 半径（0.4-3.3）
- `baseAlpha` - 基础透明度（0.3-1.0）
- `twinkleSpeed` - 闪烁速度
- `twinklePhase` - 闪烁相位
- `color` - 颜色（白色或彩色）

**数量配置**:
- `STAR_COUNT = 350` - 算法测试模式星星数
- `STAR_COUNT_HOME = 250` - 主页模式星星数

#### 3.6.4 starRenderer.ts

**职责**: 星星渲染器，根据深度和倾向绘制星星

**渲染逻辑**:
1. 计算闪烁效果（正弦函数）
2. 应用深度视差偏移
3. 根据倾向方向调整颜色（主页模式）
4. 多层光晕渲染（外层模糊 + 内层清晰）

**颜色偏移算法**:
```typescript
// 根据星星方向与倾向方向的对齐度调整颜色
const alignment = Math.cos(starAngle - tendencyDirection);
// 对齐时偏蓝，反对齐时偏红
```

#### 3.6.5 trailBuffer.ts

**职责**: 轨迹缓冲区，使用环形缓冲区存储轨迹点

**接口**:
- `TrailPoint` - `{ x: number; y: number }`
- `createTrailBuffer()` - 创建缓冲区
- `pushToBuffer()` - 推送点
- `getBufferLength()` - 获取长度
- `getBufferPoint()` - 获取指定索引点
- `clearBuffer()` - 清空缓冲区
- `resizeBuffer()` - 调整大小

#### 3.6.6 trailRenderer.ts

**职责**: 轨迹渲染器，绘制原始轨迹、平滑轨迹和预测箭头

**渲染元素**:
1. **原始轨迹** - 红色渐变线条
2. **平滑轨迹** - 青色渐变线条
3. **预测箭头** - 黄色箭头指示预测方向
4. **预测点** - 黄色圆点标记预测位置
5. **光标** - 轨迹末端的圆形标记

**预测箭头特性**:
- 长度根据预测距离自适应（30-150px）
- 透明度和宽度根据置信度调整
- 带有发光阴影效果

#### 3.6.7 entryRenderer.ts

**职责**: 入口渲染器，负责 3D 球面鱼眼投影和入口文字渲染

**投影算法**:
- 使用鱼眼投影（Fisheye Projection）
- 摄像机在球心仰望天穹
- 入口文字散布在天穹内壁

**关键函数**:
- `fishEyeProject()` - 鱼眼投影计算
- `projectEntries()` - 投影所有入口
- `renderEntries()` - 渲染入口文字（按深度排序）
- `getHighlightedEntry()` - 获取高亮入口 ID

**文字效果**:
- 逐字符渲染，带有流动动画
- 倾向值影响字体大小和发光强度
- 深度影响透明度

---

### 3.7 UI 层 (ui/)

#### 3.7.1 viewSwitcher.ts

**职责**: 视图切换器，管理多个视图的显示/隐藏

**视图列表**:
| 视图名称 | ID | 用途 |
|----------|-----|------|
| `home` | home-view | 主页 |
| `algo-test` | algo-test-view | 算法测试 |
| `about` | about-view | 关于项目 |
| `settings` | settings-view | 参数设置 |
| `source-code` | source-code-view | 源代码 |
| `math-derivation` | math-derivation-view | 数学推导 |

**关键方法**:
- `register()` - 注册视图
- `switchTo()` - 切换到指定视图
- `getCurrentView()` - 获取当前视图
- `onSwitch()` - 注册切换回调

#### 3.7.2 panelRenderer.ts

**职责**: 信息面板渲染器，显示实时数据和统计信息

**更新内容**:
1. **实时信息**: 原始坐标、平滑坐标、预测坐标、速度、方向角、置信度等
2. **统计数据**: 速度/延迟/置信度/预测误差的当前值、平均值、最大值、最小值
3. **KPI**: 方向精度、预测误差、响应延迟、静止稳定性、跟手性评分

**交互功能**:
- 面板折叠/展开（点击标题）
- 数据冻结（空格键）
- JSON/CSV 导出
- 清除历史记录

#### 3.7.3 sliderController.ts

**职责**: 滑块控制器，管理算法参数调节

**调节参数**:
| 参数 | 范围 | 默认值 | 影响 |
|------|------|--------|------|
| 噪声强度 | 0-20 | 0 | 叠加人工噪声 |
| mincutoff | 0.1-10 | 1.0 | One Euro Filter 截止频率 |
| beta | 0.001-0.1 | 0.007 | One Euro Filter 速度系数 |
| 拖尾长度 | 30-200 | 100 | 轨迹点数 |
| 混合比例 | 0-100% | 50% | Kalman/瞬时速度混合 |
| Kalman Q | 1-500 | 300 | 过程噪声 |
| Kalman R | 10-5000 | 30 | 测量噪声 |

#### 3.7.4 freezeController.ts

**职责**: 冻结控制器，管理信息面板的冻结/解冻状态

**快捷键**: `Space`（空格键）

---

### 3.8 调试工具层 (debug/)

#### 3.8.1 statsCollector.ts

**职责**: 统计收集器，收集并汇总运行时统计数据

**收集指标**:
- 速度（当前/平均/最大/最小）
- 方向延迟
- 置信度
- 预测误差
- FPS

**窗口配置**: 默认 1000ms 滑动窗口，600 点容量

#### 3.8.2 historyRecorder.ts

**职责**: 历史记录器，记录完整的鼠标运动历史

**记录内容**:
- 原始坐标、平滑坐标、预测坐标
- 速度、方向角、平滑方向角
- 置信度、状态标签、预测误差

**导出格式**: JSON / CSV

#### 3.8.3 qualityAnalyzer.ts

**职责**: 质量分析器，分析算法性能指标

**KPI 指标**:
| 指标 | 计算方式 |
|------|----------|
| `directionAccuracy` | 预测方向与实际方向的平均偏差 |
| `predErrorMean` | 预测误差平均值 |
| `responseLatency` | 方向突变后的响应延迟（帧数） |
| `stabilityStd` | 静止时坐标漂移的标准差 |
| `followScore` | 综合评分（0-100） |

**综合评分公式**:
```
followScore = (dirScore*0.3 + predScore*0.3 + latScore*0.25 + stabScore*0.15) × 100
```

#### 3.8.4 fileExporter.ts

**职责**: 文件导出器，生成并下载数据文件

**导出方法**:
- `downloadJSON()` - 导出 JSON 格式
- `downloadCSV()` - 导出 CSV 格式

---

### 3.9 数学工具层 (math/)

#### 3.9.1 angleUtils.ts

**职责**: 角度计算工具函数

**函数列表**:
| 函数 | 用途 |
|------|------|
| `degToRad()` / `radToDeg()` | 角度/弧度转换 |
| `angleDiffDeg()` / `angleDiffRad()` | 角度差计算 |
| `shortestAngleDiff()` | 最短角度差（考虑周期性） |
| `circularMean()` | 圆均值（处理角度周期性） |
| `circularStdDev()` | 圆标准差 |
| `emaAngle()` | EMA 角度平滑 |
| `clamp()` | 值范围限制 |
| `lerp()` | 线性插值 |
| `avg()` | 平均值 |
| `stdDev()` | 标准差 |

#### 3.9.2 matrix4.ts

**职责**: 矩阵运算工具，主要用于 Kalman Filter

**函数列表**:
| 函数 | 用途 |
|------|------|
| `identity4()` | 4x4 单位矩阵 |
| `transpose4()` | 矩阵转置 |
| `scaleMatrix()` | 矩阵缩放 |
| `addMat4()` / `subMat4()` | 矩阵加减 |
| `mulMat4()` | 矩阵乘法 |
| `mulMatVec4()` | 矩阵向量乘法 |
| `inv2x2()` | 2x2 矩阵求逆 |
| `diag4()` / `diag2()` | 对角矩阵 |

---

### 3.10 通用工具层 (util/)

#### 3.10.1 ringBuffer.ts

**职责**: 环形缓冲区实现，用于存储固定大小的历史数据

**核心操作**:
- `createRingBuffer()` - 创建缓冲区
- `pushRing()` - 推入元素（覆盖最旧）
- `getRingCount()` - 获取元素数量
- `getRingAt()` - 获取指定索引元素
- `clearRing()` - 清空缓冲区
- `resizeRing()` - 调整容量
- `toArray()` - 转换为数组

**使用场景**:
- 方向检测微窗口
- 置信度计算历史
- 漂移检测历史
- 统计收集窗口
- 历史记录

#### 3.10.2 fpsCounter.ts

**职责**: FPS 计数器，统计动画帧率

**计算方式**: 每 500ms 统计一次帧数，计算平均 FPS

#### 3.10.3 gaussianNoise.ts

**职责**: 高斯噪声生成器，使用 Box-Muller 变换

**用途**: 在原始坐标上叠加人工噪声，验证滤波器的降噪能力

---

## 4. 核心算法流程

### 4.1 数据处理管线

```
MouseEvent
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                DataProcessor.process()                  │
├─────────────────────────────────────────────────────────┤
│  1. 噪声注入        gaussianRandom(0, noiseStdDev)      │
│         │                                               │
│         ▼                                               │
│  2. One Euro Filter  filterCoordinate(filterX/Y, noisy) │
│         │                                               │
│         ▼                                               │
│  3. 速度计算        speed = dx/dt                       │
│         │                                               │
│         ▼                                               │
│  4. Kalman Filter   kalman.step(smoothX, smoothY)       │
│         │                                               │
│         ▼                                               │
│  5. 速度混合        blendVx = kalmanVx*ratio + direct*  │
│         │                  (1-ratio)                     │
│         ▼                                               │
│  6. 预测坐标        pred = smooth + blendV * horizon    │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                 MousePipeline.process()                  │
├─────────────────────────────────────────────────────────┤
│  7. 方向检测        DirectionDetector.detect()           │
│                 → theta, smoothedTheta, lagDeg          │
│         │                                               │
│         ▼                                               │
│  8. 置信度计算      ConfidenceCalculator.compute()       │
│                 → confidence                            │
│         │                                               │
│         ▼                                               │
│  9. 漂移检测        DriftDetector.compute()              │
│                 → drift                                 │
│         │                                               │
│         ▼                                               │
│ 10. 统计收集        StatsCollector.record()              │
│                 → predError, statsSummary               │
└─────────────────────────────────────────────────────────┘
```

### 4.2 倾向计算流程

#### 主页模式

```
预测方向 (predictedTheta)
        │
        ▼
┌─────────────────────────────────────────────────┐
│           EntryTendency.update()                │
├─────────────────────────────────────────────────┤
│  对每个入口:                                     │
│    alignment = max(0, cos(theta - entry.theta)) │
│    tendency = tendency*0.85 + alignment*0.15    │
│                                                 │
│  锁定机制:                                       │
│    若倾向值最大的入口变化 → 设置新锁定 (500ms)    │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│           TendencyEngine.update()                │
├─────────────────────────────────────────────────┤
│  circularMean(thetaWindow) → meanTheta          │
│  alignment = max(0, cos(meanTheta - target))    │
│  if alignment > 0.02:                           │
│    tendency += k * alignment * (1+tendency) * dt│
│  else:                                          │
│    tendency -= decay * tendency * dt            │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│           EntryRenderer.renderEntries()         │
├─────────────────────────────────────────────────┤
│  fishEyeProject() → 球面投影                     │
│  drawEntryText() → 逐字符渲染（流动动画）         │
│  倾向值影响: 字体大小 + 发光强度                  │
└─────────────────────────────────────────────────┘
```

#### 子界面模式

```
预测方向 (predictedTheta)
        │
        ▼
┌─────────────────────────────────────────────────┐
│         ActionTendency.update()                  │
├─────────────────────────────────────────────────┤
│  对每个按钮:                                     │
│    targetTheta = atan2(btn.center - screen.center)│
│    alignment = max(0, cos(predictedTheta -      │
│                          targetTheta))           │
│    distanceFactor = max(0.3, 1 - dist/maxDist)  │
│    weightedAlignment = alignment * distanceFactor│
│    tendency = tendency*0.85 + weightedAlignment* │
│               0.15                               │
└─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│      ActionTendencyController.applyHighlights() │
├─────────────────────────────────────────────────┤
│  获取倾向值最高的按钮 (threshold = 0.15)         │
│  添加/移除高亮 CSS 类                            │
│  设置 --tendency CSS 变量                        │
└─────────────────────────────────────────────────┘
```

### 4.3 置信度计算

```
速度 (speed)
    │
    ├─→ speed < 5 → confidence = 0
    │
    └─→ speed >= 5
            │
            ├─→ speedFactor = min(1, max(0, (speed-5)/100)) * 0.6
            │                  + (speed > 100 ? min(0.4, (speed-100)/400) : 0)
            │
            ├─→ 方向历史 (最近10个theta)
            │       │
            │       └─→ circularStdDev(angles) → stdAngleDeg
            │             stabilityFactor = max(0.3, min(1, 1 - (stdAngleDeg-3)/40))
            │
            └─→ rawConfidence = speedFactor * stabilityFactor
                  smoothedConfidence = 0.3 * rawConfidence + 0.7 * smoothedConfidence
```

---

## 5. 依赖关系

### 5.1 外部依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `@david18284/one-euro-filter` | ^1.0.3 | One Euro Filter 算法实现 |
| `typescript` | ^6.0.3 | TypeScript 编译器 |
| `vite` | ^8.1.3 | 构建工具和开发服务器 |

### 5.2 内部模块依赖关系

```
main.ts
    │
    └── bootstrap.ts
            │
            ├── app/domRefs.ts
            ├── app/eventBindings.ts
            │
            ├── processor/dataProcessor.ts
            │       ├── filter/oneEuroFilter.ts
            │       ├── filter/kalmanFilter.ts
            │       │       └── math/matrix4.ts
            │       └── util/gaussianNoise.ts
            │
            ├── detector/directionDetector.ts
            │       ├── util/ringBuffer.ts
            │       └── math/angleUtils.ts
            │
            ├── detector/confidenceCalculator.ts
            │       ├── util/ringBuffer.ts
            │       └── math/angleUtils.ts
            │
            ├── detector/driftDetector.ts
            │       └── util/ringBuffer.ts
            │
            ├── core/pipeline.ts
            │       ├── processor/dataProcessor.ts
            │       ├── detector/directionDetector.ts
            │       ├── detector/confidenceCalculator.ts
            │       ├── detector/driftDetector.ts
            │       └── debug/statsCollector.ts
            │
            ├── core/mouseHandler.ts
            │       ├── core/pipeline.ts
            │       ├── ui/panelRenderer.ts
            │       ├── debug/historyRecorder.ts
            │       └── renderer/canvas.ts
            │
            ├── core/appScheduler.ts
            │       ├── core/pipeline.ts
            │       ├── detector/driftDetector.ts
            │       ├── debug/statsCollector.ts
            │       ├── debug/qualityAnalyzer.ts
            │       ├── debug/historyRecorder.ts
            │       ├── ui/panelRenderer.ts
            │       ├── processor/dataProcessor.ts
            │       ├── renderer/canvas.ts
            │       ├── renderer/starry.ts
            │       └── util/fpsCounter.ts
            │
            ├── core/tendency.ts
            │       ├── util/ringBuffer.ts
            │       └── math/angleUtils.ts
            │
            ├── core/tendencyController.ts
            │       ├── core/tendency.ts
            │       ├── core/pipeline.ts
            │       ├── ui/viewSwitcher.ts
            │       ├── core/entryTendency.ts
            │       ├── renderer/entryRenderer.ts
            │       └── core/actionTendencyController.ts
            │
            ├── core/actionTendency.ts
            │       └── core/entryTendency.ts
            │
            ├── core/actionTendencyController.ts
            │       └── core/actionTendency.ts
            │
            ├── core/entryTendency.ts
            │       └── renderer/entryRenderer.ts
            │
            ├── renderer/canvas.ts
            │       ├── renderer/trailBuffer.ts
            │       ├── renderer/entryRenderer.ts
            │       └── renderer/trailRenderer.ts
            │
            ├── renderer/starry.ts
            │       ├── renderer/starFactory.ts
            │       ├── renderer/starRenderer.ts
            │       └── math/angleUtils.ts
            │
            ├── ui/viewSwitcher.ts
            ├── ui/panelRenderer.ts
            │       ├── debug/statsCollector.ts
            │       ├── debug/qualityAnalyzer.ts
            │       ├── debug/historyRecorder.ts
            │       └── debug/fileExporter.ts
            ├── ui/sliderController.ts
            ├── ui/freezeController.ts
            ├── config/entryConfig.ts
            └── config/profileConfig.ts
```

---

## 6. 项目运行与调试

### 6.1 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 6.2 安装依赖

```bash
npm install
```

### 6.3 启动开发服务器

```bash
npm run dev
```

服务器启动后访问: `http://localhost:5173/`

### 6.4 构建生产版本

```bash
npm run build
```

### 6.5 预览生产版本

```bash
npm run preview
```

### 6.6 调试功能

| 功能 | 快捷键/操作 | 说明 |
|------|-------------|------|
| 冻结面板 | `Space` | 冻结/解冻实时数据显示 |
| 导出 JSON | 点击"导出 JSON"按钮 | 导出历史数据为 JSON 文件 |
| 导出 CSV | 点击"导出 CSV"按钮 | 导出历史数据为 CSV 文件 |
| 清除记录 | 点击"清除记录"按钮 | 清空历史记录 |
| 折叠面板 | 点击面板标题 | 折叠/展开统计面板 |

### 6.7 调参说明

在算法测试视图中可以调节以下参数：

1. **噪声强度** - 模拟传感器噪声，测试滤波器性能
2. **mincutoff** - One Euro Filter 截止频率，越小越平滑但响应越慢
3. **beta** - One Euro Filter 速度系数，越大越能跟踪快速变化
4. **拖尾长度** - 轨迹显示的点数
5. **混合比例** - 0%=纯瞬时速度，100%=纯Kalman速度
6. **Kalman Q** - 过程噪声，越大响应越快但越不稳定
7. **Kalman R** - 测量噪声，越大越平滑但越滞后

---

## 7. 扩展指南

### 7.1 添加新的子界面

1. 在 `index.html` 中添加新的视图容器：
```html
<div id="new-view" class="view sub-view">
  <button class="back-btn" data-action-id="back-home">← 返回主页</button>
  <div class="sub-view-content">
    <h2 class="sub-view-title">新视图</h2>
    <div class="sub-view-body">...</div>
  </div>
</div>
```

2. 在 `bootstrap.ts` 的 `createViewSwitcher()` 中注册：
```typescript
viewSwitcher.register('new-view', document.getElementById('new-view')!);
```

3. 在 `eventBindings.ts` 的点击处理中添加新视图的按钮触发逻辑（如果需要）

### 7.2 添加新的主页入口

在 `config/entryConfig.ts` 中添加新的入口配置：
```typescript
{
  id: 'new-entry',
  theta: 36 * DEG,    // 方位角（弧度）
  phi: 50 * DEG,      // 仰角（弧度）
  label: '新入口',     // 显示文字
  dataView: 'new-view' // 点击后跳转的视图
}
```

### 7.3 添加子界面按钮（带算法功能）

只需在按钮元素上添加 `data-action-id` 属性：
```html
<button data-action-id="my-action">我的操作</button>
```

系统会自动检测并集成到倾向计算系统中。

### 7.4 自定义倾向计算逻辑

继承或修改以下类：
- `TendencyEngine` - 倾向引擎核心算法
- `ActionTendency` - 动作倾向计算
- `EntryTendency` - 入口倾向计算

### 7.5 扩展渲染效果

修改以下渲染器：
- `starRenderer.ts` - 星星渲染效果
- `entryRenderer.ts` - 入口文字渲染
- `trailRenderer.ts` - 轨迹渲染效果
- `starFactory.ts` - 星星生成规则

---

## 附录：关键常量汇总

### 倾向系统
| 常量 | 值 | 文件 |
|------|-----|------|
| `HIGHLIGHT_THRESHOLD` | 0.15 | actionTendency.ts |
| `LOCK_DURATION_MS` | 500 | entryTendency.ts |
| `EMA_DECAY` | 0.85 | actionTendency.ts, entryTendency.ts |
| `EMA_ALPHA` | 0.15 | actionTendency.ts, entryTendency.ts |
| `MIN_TENDENCY` | 0.01 | actionTendency.ts, entryTendency.ts |

### 检测系统
| 常量 | 值 | 文件 |
|------|-----|------|
| `MICRO_WINDOW` | 5 | directionDetector.ts |
| `THETA_HISTORY_SIZE` | 10 | confidenceCalculator.ts |
| `MAX_HISTORY` | 120 | driftDetector.ts |

### 更新频率
| 常量 | 值 | 文件 |
|------|-----|------|
| `PANEL_UPDATE_MS` | 30 | mouseHandler.ts, appScheduler.ts |
| `STATS_REFRESH_MS` | 500 | appScheduler.ts |
| `KPI_REFRESH_MS` | 3000 | appScheduler.ts |
| `RECT_REFRESH_INTERVAL_MS` | 1000 | actionTendencyController.ts |

### 渲染
| 常量 | 值 | 文件 |
|------|-----|------|
| `STAR_COUNT` | 350 | starFactory.ts |
| `STAR_COUNT_HOME` | 250 | starFactory.ts |
| `FISHEYE_F` | 0.55 | entryRenderer.ts |
| `PREDICTION_HORIZON_MS` | 100 | dataProcessor.ts |

---

## 文档版本

- **版本**: v1.0
- **生成日期**: 2026-07-16
- **项目版本**: EpsVect v0.1.0