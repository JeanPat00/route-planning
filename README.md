# 排班优化厨房

一个静态网页原型，用于模拟工厂/厨房的工位布局、员工路线、障碍物避让和 24 小时排班编辑。

## 文件结构

- `index.html`：页面骨架和主要区域容器。
- `styles.css`：全局视觉样式、厨房平面图、时间线和拖拽状态样式。
- `src/app.js`：浏览器端入口，负责 DOM 渲染、拖拽交互和状态衔接。
- `src/core/scheduler.js`：纯排班/路线/布局逻辑，包括避障路径、工位锁定和优化候选。
- `src/core/optimizer.js`：优化候选生成与排序逻辑。
- `src/core/manualSchedule.js`：纯手动排班逻辑，包括默认排班生成、任务移动、删除和时间吸附。
- `src/core/scenarioTemplates.js`：内置场景模板，包括披萨厨房和烘焙工厂。
- `src/core/scenarioStore.js`：场景导入、导出和本地保存。
- `tests/`：Node 测试，覆盖核心算法和手动排班行为。

## 后续优化建议

- 当 `src/app.js` 继续变大时，可以拆成 `src/ui/floorView.js`、`src/ui/timelineView.js`、`src/ui/panels.js`。
- 如果优化算法继续复杂化，可以继续扩展 `src/core/optimizer.js`，例如加入权重配置或更多候选策略。
- 如果要保存方案，可以新增 `src/core/scenarioStore.js`，专门处理导入、导出和本地存储。
