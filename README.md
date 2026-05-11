# Schedule Optimizer

一个面向厨房、烘焙工厂和轻量生产场景的排班与布局优化网页原型。项目支持自定义场景、设备库、工序流程、禁行区域、员工起点和 24 小时排班时间线，并基于当前布局生成路线、瓶颈指标和优化候选方案。

当前版本以纯前端静态网页实现，适合作为排班优化、工位布局和生产流程仿真的交互式 Demo。

## Features

- 两页式工作流：第一页编辑场景和工序，第二页生成路线、指标、优化方案和时间线。
- 可编辑工厂平面图：支持网格尺寸、障碍物、员工起点、设备拖拽放置和设备锁定。
- 设备库与多设备实例：同类设备可以创建多个，例如多个切片台、烤炉或包装台。
- 自定义工序流程：工序可新增、重命名、删除、重排，并绑定到设备类型。
- 自动排班模拟：按订单数、员工数、移动速度、设备容量和工序顺序生成任务时间线。
- 避障路径计算：员工路线会绕开禁行区域。
- 优化候选：提供最快方案、最少移动方案和均衡方案。
- 手动排班编辑：时间线支持 0:00-24:00 横向拖动、任务拖拽和时间吸附。
- 场景保存：支持 JSON 导入导出和 `localStorage` 本地保存。
- 可扩展算法结构：评分函数、约束、机器模型、环境模型和求解器已拆分为独立模块。

## Demo Scenarios

- 披萨厨房：面饼制作、辅料、烤箱、切片出餐。
- 烘焙工厂：配料、和面、发酵、整形、醒发、烘烤、冷却、包装、成品暂存。

## Getting Started

```bash
npm start
```

然后在浏览器打开：

```text
http://localhost:4173/
```

## Tests

```bash
npm test
```

测试覆盖核心排班模拟、避障路线、优化候选、模板导入导出、手动排班和算法模块边界。

## Project Structure

```text
.
├── index.html
├── styles.css
├── package.json
├── src
│   ├── app.js
│   └── core
│       ├── constraints.js
│       ├── environmentModel.js
│       ├── machineModel.js
│       ├── manualSchedule.js
│       ├── objective.js
│       ├── optimizer.js
│       ├── scenarioStore.js
│       ├── scenarioTemplates.js
│       ├── scheduler.js
│       └── solvers
│           └── heuristicOptimizer.js
└── tests
    ├── algorithmModules.test.js
    ├── manualSchedule.test.js
    ├── scenarioTemplates.test.js
    └── scheduler.test.js
```

## Core Modules

- `src/app.js`：浏览器端入口，负责页面状态、DOM 渲染和拖拽交互。
- `src/core/scheduler.js`：通用排班模拟、路径规划、设备分配和布局应用。
- `src/core/optimizer.js`：优化入口，目前委托到启发式求解器。
- `src/core/solvers/heuristicOptimizer.js`：启发式候选布局生成与排序。
- `src/core/objective.js`：评分函数与优化权重。
- `src/core/constraints.js`：设备放置、工序匹配和可移动性约束。
- `src/core/machineModel.js`：机器寿命、满载效率、日常效率等模型入口。
- `src/core/environmentModel.js`：温度、湿度等环境参数模型入口。
- `src/core/manualSchedule.js`：手动排班任务生成、移动、删除和时间吸附。
- `src/core/scenarioTemplates.js`：内置场景模板。
- `src/core/scenarioStore.js`：JSON 导入导出和本地保存。

## Roadmap

- 增加多目标权重滑杆，例如完成时间、移动距离、设备等待、能耗和机器损耗。
- 增加更多求解器，例如模拟退火、遗传算法或约束规划。
- 接入机器学习模型，用于预测不同温湿度、机器健康度和负载下的加工时间或故障风险。
- 支持并行工序、前置依赖 DAG 和更复杂的生产批次策略。
- 拆分 `src/app.js` 为更小的 UI 模块，例如平面图、设备面板、流程编辑器和时间线。

## License

This project is currently for prototype and demonstration use.
