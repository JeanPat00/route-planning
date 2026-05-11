import {
  addStation,
  createDefaultScenario,
  optimizeScenario,
  simulateScenario,
  toggleStationFixed,
  toggleBlockedCell,
  updateGrid,
  addStep,
  removeStation,
  removeStep,
  reorderStep,
  updateStepConfig,
  updateStationConfig,
  updateStartPosition,
  updateStationPosition,
} from "./core/scheduler.js";
import { getScenarioTemplates } from "./core/scenarioTemplates.js";
import { exportScenario, importScenario, loadScenario, saveScenario } from "./core/scenarioStore.js";
import {
  createDefaultManualTasks,
  createManualTask,
  getManualScheduleSummary,
  moveManualTask,
  reconcileManualTasks,
  removeManualTask,
} from "./core/manualSchedule.js";

const colors = {
  doughTable: "#7d5f35",
  toppings: "#8a6d3b",
  oven: "#1c1c1c",
  slice: "#5f5f5d",
};

const routeColors = ["#1c1c1c", "#8a6d3b", "#7d5f35", "#5f5f5d", "#3f3f3d"];
const fallbackStationColors = ["#6f5b3e", "#7b6f42", "#4f5d50", "#45423e", "#866f46", "#657061"];

const DAY_MINUTES = 24 * 60;
const TIMELINE_SNAP_MINUTES = 60;
const NEW_TASK_DURATION = 60;
const STORAGE_KEY = "kitchen-schedule-optimizer-scenario";
const templates = getScenarioTemplates();

let scenario = loadScenario(window.localStorage, STORAGE_KEY) ?? createDefaultScenario();
let simulation = simulateScenario(scenario);
let optimization = optimizeScenario(scenario);
let activeCandidateId = null;
let manualTasks = createDefaultManualTasks(simulation.timeline, {
  spreadToMinutes: DAY_MINUTES,
});
let scheduleCustomized = false;
let stationEditMode = true;
let flowEditMode = false;
let layoutEditMode = true;
let blockedEditMode = false;
let currentPage = "setup";
let historyStack = [];

const floor = document.querySelector("#floor");
const stationLayer = document.querySelector("#stationLayer");
const blockedLayer = document.querySelector("#blockedLayer");
const heatLayer = document.querySelector("#heatLayer");
const routeLayer = document.querySelector("#routeLayer");
const stationList = document.querySelector("#stationList");
const metricGrid = document.querySelector("#metricGrid");
const bottleneckCard = document.querySelector("#bottleneckCard");
const candidateList = document.querySelector("#candidateList");
const timeline = document.querySelector("#timeline");
const timelineScroll = document.querySelector("#timelineScroll");
const timelineSummary = document.querySelector("#timelineSummary");
const timelineStepPalette = document.querySelector("#timelineStepPalette");
const stepsList = document.querySelector("#stepsList");
const ordersInput = document.querySelector("#ordersInput");
const workersInput = document.querySelector("#workersInput");
const speedInput = document.querySelector("#speedInput");
const ordersValue = document.querySelector("#ordersValue");
const workersValue = document.querySelector("#workersValue");
const speedValue = document.querySelector("#speedValue");
const templateSelect = document.querySelector("#templateSelect");
const exportButton = document.querySelector("#exportButton");
const importInput = document.querySelector("#importInput");
const layoutEditButton = document.querySelector("#layoutEditButton");
const blockedEditButton = document.querySelector("#blockedEditButton");
const undoButton = document.querySelector("#undoButton");
const gridWidthInput = document.querySelector("#gridWidthInput");
const gridHeightInput = document.querySelector("#gridHeightInput");
const enterScheduleButton = document.querySelector("#enterScheduleButton");
const backSetupButton = document.querySelector("#backSetupButton");
const setupIntro = document.querySelector("#setupIntro");
const processPlan = document.querySelector("#processPlan");
const addProcessStepButton = document.querySelector("#addProcessStepButton");

templateSelect.innerHTML = templates
  .map((template) => `<option value="${template.id}">${template.label}</option>`)
  .join("");
templateSelect.value = scenario.templateType ?? templates[0].id;

function snapshotScenario() {
  return JSON.parse(JSON.stringify(scenario));
}

function pushHistory() {
  if (currentPage !== "setup") {
    return;
  }
  historyStack.push(snapshotScenario());
  if (historyStack.length > 80) {
    historyStack.shift();
  }
}

function applyScenario(nextScenario, options = {}) {
  if (options.track) {
    pushHistory();
  }
  scenario = nextScenario;
  activeCandidateId = null;
  scheduleCustomized = false;
  recalculate();
}

document.querySelector("#resetButton").addEventListener("click", () => {
  const template = templates.find((item) => item.id === templateSelect.value) ?? templates[0];
  scenario = template.create({
    orders: Number(ordersInput.value),
    workers: Number(workersInput.value),
    workerSpeed: Number(speedInput.value),
  });
  activeCandidateId = null;
  scheduleCustomized = false;
  historyStack = [];
  blockedEditMode = false;
  stationEditMode = currentPage === "setup";
  layoutEditMode = currentPage === "setup";
  recalculate();
});

templateSelect.addEventListener("change", () => {
  const template = templates.find((item) => item.id === templateSelect.value) ?? templates[0];
  scenario = template.create({
    orders: Number(ordersInput.value),
    workers: Number(workersInput.value),
    workerSpeed: Number(speedInput.value),
  });
  activeCandidateId = null;
  scheduleCustomized = false;
  historyStack = [];
  blockedEditMode = false;
  stationEditMode = currentPage === "setup";
  flowEditMode = false;
  layoutEditMode = currentPage === "setup";
  recalculate();
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([exportScenario(scenario)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${scenario.name ?? "scenario"}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) {
    return;
  }
  scenario = importScenario(await file.text());
  templateSelect.value = scenario.templateType ?? "";
  activeCandidateId = null;
  scheduleCustomized = false;
  historyStack = [];
  blockedEditMode = false;
  recalculate();
  importInput.value = "";
});

layoutEditButton.addEventListener("click", () => {
  layoutEditMode = !layoutEditMode;
  render();
});

blockedEditButton.addEventListener("click", () => {
  blockedEditMode = !blockedEditMode;
  render();
});

undoButton.addEventListener("click", () => {
  const previous = historyStack.pop();
  if (!previous) {
    return;
  }
  scenario = previous;
  activeCandidateId = null;
  scheduleCustomized = false;
  recalculate();
});

gridWidthInput.addEventListener("change", updateGridFromInputs);
gridHeightInput.addEventListener("change", updateGridFromInputs);
floor.addEventListener("click", (event) => {
  if (!blockedEditMode || event.target.closest(".station-node, .start-node")) {
    return;
  }
  const rect = floor.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * scenario.grid.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * scenario.grid.height);
  applyScenario(toggleBlockedCell(scenario, { x, y }), { track: true });
});

floor.addEventListener("dragover", (event) => {
  if (currentPage !== "setup") {
    return;
  }
  const payload = event.dataTransfer.types.includes("text/plain");
  if (payload) {
    event.preventDefault();
    floor.classList.add("drag-over");
  }
});

floor.addEventListener("dragleave", () => {
  floor.classList.remove("drag-over");
});

floor.addEventListener("drop", (event) => {
  event.preventDefault();
  floor.classList.remove("drag-over");
  const payload = event.dataTransfer.getData("text/plain");
  if (!payload.startsWith("station:")) {
    return;
  }
  const stationId = payload.replace("station:", "");
  const rect = floor.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * scenario.grid.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * scenario.grid.height);
  applyScenario(updateStationPosition(scenario, stationId, { x, y }), { track: true });
});

processPlan.addEventListener("dragover", (event) => {
  if (currentPage !== "setup") {
    return;
  }
  event.preventDefault();
  processPlan.classList.add("drag-over");
});

processPlan.addEventListener("dragleave", () => {
  processPlan.classList.remove("drag-over");
});

processPlan.addEventListener("drop", (event) => {
  event.preventDefault();
  processPlan.classList.remove("drag-over");
  const payload = event.dataTransfer.getData("text/plain");
  if (payload.startsWith("station:")) {
    const station = scenario.stations.find(
      (stationItem) => stationItem.id === payload.replace("station:", ""),
    );
    if (!station) {
      return;
    }
    applyScenario(
      addStep(scenario, {
        label: station.label,
        stationId: station.id,
        stationType: station.type,
      }),
      { track: true },
    );
  }
});

addProcessStepButton.addEventListener("click", () => {
  applyScenario(
    addStep(scenario, {
      label: "新工序",
      stationId: scenario.stations[0]?.id,
    }),
    { track: true },
  );
});

document.querySelector("#restoreScheduleButton").addEventListener("click", () => {
  scheduleCustomized = false;
  recalculate();
});

enterScheduleButton.addEventListener("click", () => {
  currentPage = "schedule";
  stationEditMode = false;
  layoutEditMode = false;
  flowEditMode = false;
  blockedEditMode = false;
  recalculate();
});

backSetupButton.addEventListener("click", () => {
  currentPage = "setup";
  stationEditMode = true;
  layoutEditMode = true;
  flowEditMode = false;
  blockedEditMode = false;
  render();
});

document.querySelector("#optimizeButton").addEventListener("click", () => {
  optimization = optimizeScenario(scenario);
  scenario = optimization.recommended;
  activeCandidateId = optimization.candidates[0].id;
  scheduleCustomized = false;
  syncInputs();
  recalculate();
});

ordersInput.addEventListener("input", updateScenarioSettings);
workersInput.addEventListener("input", updateScenarioSettings);
speedInput.addEventListener("input", updateScenarioSettings);
timelineScroll.addEventListener("pointerdown", startTimelinePan);

function updateScenarioSettings() {
  scenario = {
    ...scenario,
    orders: Number(ordersInput.value),
    workerCount: Number(workersInput.value),
    workerSpeed: Number(speedInput.value),
  };
  activeCandidateId = null;
  scheduleCustomized = false;
  recalculate();
}

function recalculate() {
  simulation = simulateScenario(scenario);
  optimization = optimizeScenario(scenario);
  if (scheduleCustomized) {
    manualTasks = reconcileManualTasks(
      manualTasks,
      scenario.workerCount,
      DAY_MINUTES,
      TIMELINE_SNAP_MINUTES,
    );
  } else {
    manualTasks = createDefaultManualTasks(simulation.timeline, {
      spreadToMinutes: DAY_MINUTES,
    });
  }
  saveScenario(window.localStorage, STORAGE_KEY, scenario);
  render();
}

function render() {
  syncInputs();
  renderBlockedCells();
  renderStations();
  renderStationList();
  renderProcessPlan();
  renderRoutes();
  renderHeat();
  renderMetrics();
  renderBottleneck();
  renderSteps();
  renderCandidates();
  renderTimelineStepPalette();
  renderTimeline();
}

function syncInputs() {
  document.querySelector(".topbar h1").textContent = scenario.name ?? "工厂排班优化";
  document.querySelector(".topbar p").textContent = `${scenario.name ?? "自定义场景"}流程布局与员工排班模拟`;
  ordersInput.value = scenario.orders;
  workersInput.value = scenario.workerCount;
  speedInput.value = scenario.workerSpeed;
  ordersValue.textContent = `${scenario.orders} 张`;
  workersValue.textContent = `${scenario.workerCount} 人`;
  speedValue.textContent = `${Number(scenario.workerSpeed).toFixed(1)} 格/分钟`;
  gridWidthInput.value = scenario.grid.width;
  gridHeightInput.value = scenario.grid.height;
  layoutEditButton.textContent = layoutEditMode ? "完成平面图" : "编辑平面图";
  blockedEditButton.textContent = blockedEditMode ? "完成禁行区" : "添加禁行区";
  undoButton.disabled = historyStack.length === 0 || currentPage !== "setup";
  floor.dataset.editing = blockedEditMode ? "true" : "false";
  floor.dataset.routeVisible = currentPage === "schedule" ? "true" : "false";
  document.body.dataset.page = currentPage;
  setupIntro.hidden = currentPage !== "setup";
  enterScheduleButton.hidden = currentPage !== "setup";
  backSetupButton.hidden = currentPage !== "schedule";
  document.querySelector("#optimizeButton").hidden = currentPage !== "schedule";
  floor.style.setProperty("--grid-width", scenario.grid.width);
  floor.style.setProperty("--grid-height", scenario.grid.height);
  floor.style.aspectRatio = `${scenario.grid.width} / ${scenario.grid.height}`;
}

function updateGridFromInputs() {
  applyScenario(
    updateGrid(scenario, {
      width: Number(gridWidthInput.value),
      height: Number(gridHeightInput.value),
    }),
    { track: true },
  );
}

function renderStations() {
  stationLayer.innerHTML = "";
  const startNode = document.createElement("div");
  startNode.className = "start-node";
  startNode.style.left = `${gridToPercentX(scenario.startPosition.x)}%`;
  startNode.style.top = `${gridToPercentY(scenario.startPosition.y)}%`;
  startNode.innerHTML = `<b>始</b><span>员工起点</span>`;
  if (currentPage === "setup") {
    startNode.addEventListener("pointerdown", startStartPointDrag);
  }
  stationLayer.append(startNode);

  for (const station of scenario.stations.filter((stationItem) => stationItem.position)) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "station-node";
    node.dataset.stationId = station.id;
    node.dataset.fixed = station.fixed ? "true" : "false";
    node.style.background = stationColor(station.id);
    node.style.left = `${gridToPercentX(station.position.x)}%`;
    node.style.top = `${gridToPercentY(station.position.y)}%`;
    node.innerHTML = `<b>${stationIcon(station.id)}</b><div><strong>${station.label}</strong><span>${station.processTime} 分钟 · 容量 ${station.capacity}</span></div>`;
    stationLayer.append(node);
    if (currentPage === "setup" && !station.fixed) {
      node.addEventListener("pointerdown", startDrag);
    }
  }
}

function renderBlockedCells() {
  blockedLayer.innerHTML = scenario.blockedCells
    .map(
      (cell) => `
        <div class="blocked-cell" style="left:${(cell.x / scenario.grid.width) * 100}%;top:${(cell.y / scenario.grid.height) * 100}%;width:${100 / scenario.grid.width}%;height:${100 / scenario.grid.height}%"></div>
      `,
    )
    .join("");
}

function renderStationList() {
  stationList.innerHTML = `
    <div class="station-list-head">
      <span>${stationEditMode ? "编辑设备参数 · 拖到平面图放置" : "设备概览"}</span>
      <button class="ghost-button compact-button" id="stationEditButton" type="button">
        ${stationEditMode ? "完成" : "编辑"}
      </button>
    </div>
    ${scenario.stations
    .map(
      (station) =>
        stationEditMode
          ? `
        <div class="station-item" draggable="true" data-drag-station="${station.id}">
          <div class="station-icon" style="background:${stationColor(station.id)}">${stationIcon(station.id)}</div>
          <div class="station-editor">
            <label>
              名称
              <input data-station-field="label" data-station-id="${station.id}" type="text" value="${escapeAttr(station.label)}" />
            </label>
            <label>
              类型
              <input data-station-field="type" data-station-id="${station.id}" type="text" value="${escapeAttr(station.type)}" />
            </label>
            <div class="station-editor-grid">
              <label>
                容量
                <input data-station-field="capacity" data-station-id="${station.id}" type="number" min="1" max="6" value="${station.capacity}" />
              </label>
              <label>
                时长
                <input data-station-field="processTime" data-station-id="${station.id}" type="number" min="1" max="240" value="${station.processTime}" />
              </label>
            </div>
            <small>${station.position ? `已放置 (${station.position.x}, ${station.position.y})` : "未放置 · 拖到平面图"}</small>
          </div>
          <button class="lock-button" type="button" data-lock-station="${station.id}">
            ${station.fixed ? "解锁" : "锁定"}
          </button>
          ${
            station.custom
              ? `<button class="lock-button danger-button" type="button" data-remove-station="${station.id}">删除</button>`
              : ""
          }
        </div>
      `
          : `
        <div class="station-item station-readonly">
          <div class="station-icon" style="background:${stationColor(station.id)}">${stationIcon(station.id)}</div>
          <div>
            <strong>${station.label}</strong>
            <small>容量 ${station.capacity} · ${station.processTime} 分钟 · ${
              station.position ? `(${station.position.x}, ${station.position.y})` : "未放置"
            }</small>
          </div>
          ${station.fixed ? '<span class="fixed-tag">锁定</span>' : ""}
        </div>
      `,
    )
    .join("")}
    ${
      stationEditMode
        ? '<button class="add-station-button" id="addStationButton" type="button">+ 新增设备</button>'
        : ""
    }
  `;

  document.querySelector("#stationEditButton").addEventListener("click", () => {
    stationEditMode = !stationEditMode;
    renderStationList();
  });

  document.querySelector("#addStationButton")?.addEventListener("click", () => {
    applyScenario(addStation(scenario, {
      label: "新设备",
      type: "custom",
      capacity: 1,
      processTime: 10,
    }), { track: true });
  });

  stationList.querySelectorAll("[data-drag-station]").forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("text/plain", `station:${item.dataset.dragStation}`);
    });
  });

  stationList.querySelectorAll("[data-station-field]").forEach((input) => {
    input.addEventListener("change", () => {
      const station = scenario.stations.find((item) => item.id === input.dataset.stationId);
      applyScenario(updateStationConfig(scenario, input.dataset.stationId, {
        label:
          input.dataset.stationField === "label"
            ? input.value
            : station.label,
        type:
          input.dataset.stationField === "type"
            ? input.value
            : station.type,
        capacity:
          input.dataset.stationField === "capacity"
            ? input.value
            : station.capacity,
        processTime:
          input.dataset.stationField === "processTime"
            ? input.value
            : station.processTime,
      }), { track: true });
    });
  });

  stationList.querySelectorAll("[data-lock-station]").forEach((button) => {
    button.addEventListener("click", () => {
      applyScenario(toggleStationFixed(scenario, button.dataset.lockStation), { track: true });
    });
  });

  stationList.querySelectorAll("[data-remove-station]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = removeStation(scenario, button.dataset.removeStation);
      if (!result.removed) {
        window.alert("这个设备仍被流程引用，请先调整流程步骤。");
        return;
      }
      applyScenario(result.scenario, { track: true });
    });
  });
}

function renderProcessPlan() {
  if (!processPlan) {
    return;
  }

  processPlan.innerHTML = scenario.steps
    .map((step, index) => {
      const station = stationForStep(step);
      const stationOptions = scenario.stations
        .map(
          (item) =>
            `<option value="${item.id}" ${item.id === step.stationId ? "selected" : ""}>${item.label}</option>`,
        )
        .join("");
      return `
        <article class="process-card" draggable="true" data-process-index="${index}">
          <div class="process-number" style="background:${stationColor(station?.id)}">${index + 1}</div>
          <div class="process-card-body">
            <label>
              工序
              <input data-process-field="label" data-step-id="${step.id}" type="text" value="${escapeAttr(step.label)}" />
            </label>
            <label>
              绑定设备
              <select data-process-field="stationId" data-step-id="${step.id}">
                ${stationOptions}
              </select>
            </label>
            <small>${station ? `${station.type} · ${station.position ? "已放置" : "未放置"}` : "未绑定设备"}</small>
          </div>
          <button class="process-remove" type="button" aria-label="删除 ${escapeAttr(step.label)}" data-process-remove="${step.id}">×</button>
        </article>
      `;
    })
    .join("");

  processPlan.querySelectorAll("[data-process-index]").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `process:${card.dataset.processIndex}`);
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      card.classList.remove("drag-over");
      const payload = event.dataTransfer.getData("text/plain");
      if (!payload.startsWith("process:")) {
        return;
      }
      const fromIndex = Number(payload.replace("process:", ""));
      const toIndex = Number(card.dataset.processIndex);
      applyScenario(reorderStep(scenario, fromIndex, toIndex), { track: true });
    });
  });

  processPlan.querySelectorAll("[data-process-field]").forEach((field) => {
    field.addEventListener("change", () => {
      const step = scenario.steps.find((item) => item.id === field.dataset.stepId);
      applyScenario(
        updateStepConfig(scenario, field.dataset.stepId, {
          label: field.dataset.processField === "label" ? field.value : step.label,
          stationId: field.dataset.processField === "stationId" ? field.value : step.stationId,
        }),
        { track: true },
      );
    });
  });

  processPlan.querySelectorAll("[data-process-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      applyScenario(removeStep(scenario, button.dataset.processRemove), { track: true });
    });
  });
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderRoutes() {
  if (currentPage !== "schedule") {
    routeLayer.innerHTML = "";
    return;
  }
  const rect = floor.getBoundingClientRect();
  routeLayer.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  routeLayer.innerHTML = simulation.paths
    .map((path) => {
      const color = routeColorForWorker(path.workerId);
      const points = (path.points ?? [path.from, path.to])
        .map((point) => gridToPoint(point, rect))
        .map((point) => `${point.x},${point.y}`)
        .join(" ");
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.78" />`;
    })
    .join("");
}

function renderHeat() {
  if (currentPage !== "schedule") {
    heatLayer.innerHTML = "";
    return;
  }
  const counts = new Map();
  for (const path of simulation.paths) {
    const key = `${path.to.x}-${path.to.y}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  heatLayer.innerHTML = [...counts.entries()]
    .map(([key, count]) => {
      const [x, y] = key.split("-").map(Number);
      return `<div class="heat-dot" style="left:${gridToPercentX(x)}%;top:${gridToPercentY(y)}%;opacity:${Math.min(0.75, 0.18 + count * 0.08)}"></div>`;
    })
    .join("");
}

function renderMetrics() {
  const busiest = [...simulation.metrics.stationLoads].sort(
    (a, b) => b.utilization - a.utilization,
  )[0];
  const metrics = [
    ["总完成时间", `${simulation.metrics.totalDuration} 分钟`],
    ["移动距离", `${simulation.metrics.totalDistance} 格`],
    ["设备等待", `${simulation.metrics.stationWait} 分钟`],
    ["最高利用率", `${busiest?.label ?? "-"} ${Math.round((busiest?.utilization ?? 0) * 100)}%`],
  ];
  metricGrid.innerHTML = metrics
    .map(
      ([label, value]) => `
      <div class="metric-card">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `,
    )
    .join("");
}

function renderBottleneck() {
  const bottleneck = simulation.metrics.bottleneck;
  if (!bottleneck) {
    bottleneckCard.innerHTML = `
      <span>当前瓶颈工位</span>
      <strong>暂无</strong>
      <p>请先放置与工序匹配的设备，再进入排班生成指标。</p>
    `;
    return;
  }
  bottleneckCard.innerHTML = `
    <span>当前瓶颈工位</span>
    <strong>${bottleneck.label}</strong>
    <p>等待 ${bottleneck.wait} 分钟，利用率 ${Math.round(bottleneck.utilization * 100)}%。优先调整它前后的距离和容量。</p>
  `;
}

function renderSteps() {
  stepsList.innerHTML = `
    <div class="flow-list-head">
      <span>${flowEditMode ? "编辑流程步骤" : "流程步骤"}</span>
      <button class="ghost-button compact-button" id="flowEditButton" type="button">
        ${flowEditMode ? "完成" : "编辑"}
      </button>
    </div>
    ${scenario.steps
    .map((step, index) => {
      const station = stationForStep(step);
      return flowEditMode
        ? `
        <li class="step-editor-row">
          <span>${index + 1}</span>
          <div class="step-editor">
            <input data-step-field="label" data-step-id="${step.id}" type="text" value="${escapeAttr(step.label)}" />
            <select data-step-field="stationId" data-step-id="${step.id}">
              ${scenario.stations
                .map(
                  (item) =>
                    `<option value="${item.id}" ${item.id === step.stationId ? "selected" : ""}>${item.label}</option>`,
                )
                .join("")}
            </select>
          </div>
          <div class="step-actions">
            <button type="button" data-step-up="${index}">↑</button>
            <button type="button" data-step-down="${index}">↓</button>
            <button type="button" data-remove-step="${step.id}">×</button>
          </div>
        </li>
      `
        : `
        <li>
          <span>${index + 1}</span>
          <div>
            <strong>${step.label}</strong>
            <small>${station?.label ?? "未绑定"} · ${station?.processTime ?? 0} 分钟</small>
          </div>
        </li>
      `;
    })
    .join("")}
    ${flowEditMode ? '<button class="add-station-button" id="addStepButton" type="button">+ 新增工序</button>' : ""}
  `;

  document.querySelector("#flowEditButton").addEventListener("click", () => {
    flowEditMode = !flowEditMode;
    renderSteps();
  });

  document.querySelector("#addStepButton")?.addEventListener("click", () => {
    applyScenario(addStep(scenario, {
      label: "新工序",
      stationId: scenario.stations[0]?.id,
    }), { track: true });
  });

  stepsList.querySelectorAll("[data-step-field]").forEach((field) => {
    field.addEventListener("change", () => {
      const step = scenario.steps.find((item) => item.id === field.dataset.stepId);
      applyScenario(updateStepConfig(scenario, field.dataset.stepId, {
        label: field.dataset.stepField === "label" ? field.value : step.label,
        stationId: field.dataset.stepField === "stationId" ? field.value : step.stationId,
      }), { track: true });
    });
  });

  stepsList.querySelectorAll("[data-step-up]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.stepUp);
      applyScenario(reorderStep(scenario, index, index - 1), { track: true });
    });
  });

  stepsList.querySelectorAll("[data-step-down]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.stepDown);
      applyScenario(reorderStep(scenario, index, index + 1), { track: true });
    });
  });

  stepsList.querySelectorAll("[data-remove-step]").forEach((button) => {
    button.addEventListener("click", () => {
      applyScenario(removeStep(scenario, button.dataset.removeStep), { track: true });
    });
  });
}

function renderTimelineStepPalette() {
  timelineStepPalette.innerHTML = scenario.steps
    .map((step) => {
      const station = stationForStep(step);
      return `
        <button class="schedule-step-chip" draggable="true" type="button" data-step-id="${step.id}" style="--step-color:${stationColor(station?.id)}">
          <span>${stationIcon(station?.id)}</span>
          <strong>${step.label}</strong>
          <small>1 小时</small>
        </button>
      `;
    })
    .join("");

  timelineStepPalette.querySelectorAll("[data-step-id]").forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", `step:${item.dataset.stepId}`);
    });
  });
}

function renderCandidates() {
  candidateList.innerHTML = optimization.candidates
    .map((candidate) => {
      const active = candidate.id === activeCandidateId ? " active" : "";
      const busiest = [...candidate.metrics.stationLoads].sort(
        (a, b) => b.utilization - a.utilization,
      )[0];
      return `
        <button class="candidate-card${active}" type="button" data-candidate-id="${candidate.id}">
          <div class="candidate-title">
            <strong>${candidate.label}</strong>
            <span>${candidate.metrics.score}</span>
          </div>
          <small>${candidate.metrics.totalDuration} 分钟 · ${candidate.metrics.totalDistance} 格 · ${busiest?.label ?? "设备"} ${Math.round((busiest?.utilization ?? 0) * 100)}%</small>
        </button>
      `;
    })
    .join("");

  candidateList.querySelectorAll(".candidate-card").forEach((button) => {
    button.addEventListener("click", () => {
      const candidate = optimization.candidates.find(
        (item) => item.id === button.dataset.candidateId,
      );
      scenario = candidate.scenario;
      activeCandidateId = candidate.id;
      recalculate();
    });
  });
}

function renderTimeline() {
  const rows = [
    ...Array.from({ length: scenario.workerCount }, (_, index) => `worker-${index + 1}`),
  ];
  const labels = new Map([
    ...Array.from({ length: scenario.workerCount }, (_, index) => [
      `worker-${index + 1}`,
      `员工 ${index + 1}`,
    ]),
  ]);
  const maxTime = DAY_MINUTES;
  const manualSummary = getManualScheduleSummary(manualTasks);
  const mode = scheduleCustomized ? "已修改" : "默认排班";
  timelineSummary.textContent = `${mode} · 0:00-24:00 · 自动完成 ${simulation.metrics.totalDuration} 分钟 · ${manualSummary.taskCount} 项`;
  const axis = `
    <div class="timeline-row timeline-axis-row">
      <div class="timeline-label">时间</div>
      <div class="timeline-axis">
        ${Array.from({ length: 25 }, (_, hour) => `<span style="left:${(hour / 24) * 100}%">${String(hour).padStart(2, "0")}:00</span>`).join("")}
      </div>
    </div>
  `;
  timeline.innerHTML =
    axis +
    rows
    .map((rowId) => {
      const equipmentBlocks = simulation.timeline
        .filter((item) => item.workerId === rowId || item.stationId === rowId)
        .map((item) => {
          const left = (item.start / maxTime) * 100;
          const width = ((item.end - item.start) / maxTime) * 100;
          return `<div class="timeline-block readonly-block" style="left:${left}%;width:${width}%;background:${stationColor(item.stationId)}">#${item.orderId} ${item.stepLabel}</div>`;
        })
        .join("");
      const manualBlocks = manualTasks
        .filter((item) => item.workerId === rowId)
        .map((item) => {
          const left = (item.start / maxTime) * 100;
          const width = (item.duration / maxTime) * 100;
          return `
            <div class="timeline-block manual-block" draggable="true" data-task-id="${item.id}" style="left:${left}%;width:${width}%;background:${stationColor(item.stationId)}">
              <span>${item.stepLabel}</span>
              <button type="button" aria-label="删除 ${item.stepLabel}" data-remove-task="${item.id}">×</button>
            </div>
          `;
        })
        .join("");
      const editable = rowId.startsWith("worker-") ? "true" : "false";
      const emptyHint =
        editable === "true" && !manualTasks.some((item) => item.workerId === rowId)
          ? '<span class="drop-hint">拖入工序</span>'
          : "";
      const blocks = editable === "true" ? manualBlocks : equipmentBlocks;
      return `
        <div class="timeline-row">
          <div class="timeline-label">${labels.get(rowId)}</div>
          <div class="timeline-track" data-row-id="${rowId}" data-editable="${editable}">${blocks}${emptyHint}</div>
        </div>
      `;
    })
    .join("");

  timeline.querySelectorAll('[data-editable="true"]').forEach((track) => {
    track.addEventListener("dragover", (event) => {
      event.preventDefault();
      track.classList.add("drag-over");
    });
    track.addEventListener("dragleave", () => {
      track.classList.remove("drag-over");
    });
    track.addEventListener("drop", (event) => {
      event.preventDefault();
      track.classList.remove("drag-over");
      handleTimelineDrop(event, track, maxTime);
    });
  });

  timeline.querySelectorAll("[data-task-id]").forEach((block) => {
    block.addEventListener("pointerdown", startTimelineBlockDrag);
    block.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `task:${block.dataset.taskId}`);
    });
  });

  timeline.querySelectorAll("[data-remove-task]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      manualTasks = removeManualTask(manualTasks, button.dataset.removeTask);
      scheduleCustomized = true;
      renderTimeline();
    });
  });
}

function startTimelinePan(event) {
  if (event.target.closest("button, .manual-block, .timeline-block")) {
    return;
  }

  const startX = event.clientX;
  const startScrollLeft = timelineScroll.scrollLeft;
  let moved = false;
  timelineScroll.setPointerCapture(event.pointerId);
  timelineScroll.classList.add("is-panning");

  const move = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    if (Math.abs(delta) > 2) {
      moved = true;
    }
    timelineScroll.scrollLeft = startScrollLeft - delta;
  };

  const stop = () => {
    timelineScroll.classList.remove("is-panning");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    if (moved) {
      event.preventDefault();
    }
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
}

function handleTimelineDrop(event, track, maxTime) {
  const payload = event.dataTransfer.getData("text/plain");
  const workerId = track.dataset.rowId;
  const start = timeFromDrop(event, track, maxTime);

  if (payload.startsWith("step:")) {
    const stepId = payload.replace("step:", "");
    const step = getManualStep(stepId);
    manualTasks = createManualTask(
      manualTasks,
      step,
      workerId,
      start,
      maxTime,
      TIMELINE_SNAP_MINUTES,
    );
    scheduleCustomized = true;
    renderTimeline();
    return;
  }

  if (payload.startsWith("task:")) {
    const taskId = payload.replace("task:", "");
    manualTasks = moveManualTask(
      manualTasks,
      taskId,
      workerId,
      start,
      maxTime,
      TIMELINE_SNAP_MINUTES,
    );
    scheduleCustomized = true;
    renderTimeline();
  }
}

function getManualStep(stepId) {
  const step = scenario.steps.find((item) => item.id === stepId);
  const station = stationForStep(step);
  return {
    id: step.id,
    label: step.label,
    stationId: station?.id ?? "unassigned",
    stationLabel: station?.label ?? "未绑定设备",
    duration: NEW_TASK_DURATION,
  };
}

function timeFromDrop(event, track, maxTime) {
  const rect = track.getBoundingClientRect();
  const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
  return ratio * maxTime;
}

function startTimelineBlockDrag(event) {
  if (event.target.closest("[data-remove-task]")) {
    return;
  }

  const block = event.currentTarget;
  const taskId = block.dataset.taskId;
  const track = block.closest(".timeline-track");
  const workerId = track.dataset.rowId;
  const maxTime = DAY_MINUTES;
  const startX = event.clientX;
  const task = manualTasks.find((item) => item.id === taskId);
  const originalStart = task.start;

  event.preventDefault();
  block.setPointerCapture(event.pointerId);
  block.classList.add("is-moving");

  const move = (moveEvent) => {
    const rect = track.getBoundingClientRect();
    const deltaMinutes = ((moveEvent.clientX - startX) / rect.width) * maxTime;
    const previewStart = Math.min(
      Math.max(0, originalStart + deltaMinutes),
      maxTime - task.duration,
    );
    block.style.left = `${(previewStart / maxTime) * 100}%`;
  };

  const stop = (upEvent) => {
    const rect = track.getBoundingClientRect();
    const deltaMinutes = ((upEvent.clientX - startX) / rect.width) * maxTime;
    manualTasks = moveManualTask(
      manualTasks,
      taskId,
      workerId,
      originalStart + deltaMinutes,
      maxTime,
      TIMELINE_SNAP_MINUTES,
    );
    scheduleCustomized = true;
    block.classList.remove("is-moving");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    renderTimeline();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
}

function startDrag(event) {
  const stationId = event.currentTarget.dataset.stationId;
  pushHistory();
  event.currentTarget.setPointerCapture(event.pointerId);

  const move = (moveEvent) => {
    const rect = floor.getBoundingClientRect();
    const x = Math.round(((moveEvent.clientX - rect.left) / rect.width) * scenario.grid.width);
    const y = Math.round(((moveEvent.clientY - rect.top) / rect.height) * scenario.grid.height);
    scenario = updateStationPosition(scenario, stationId, { x, y });
    activeCandidateId = null;
    scheduleCustomized = false;
    simulation = simulateScenario(scenario);
    manualTasks = createDefaultManualTasks(simulation.timeline, {
      spreadToMinutes: DAY_MINUTES,
    });
    render();
  };

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
}

function startStartPointDrag(event) {
  pushHistory();
  event.currentTarget.setPointerCapture(event.pointerId);

  const move = (moveEvent) => {
    const rect = floor.getBoundingClientRect();
    const x = Math.round(((moveEvent.clientX - rect.left) / rect.width) * scenario.grid.width);
    const y = Math.round(((moveEvent.clientY - rect.top) / rect.height) * scenario.grid.height);
    scenario = updateStartPosition(scenario, { x, y });
    activeCandidateId = null;
    scheduleCustomized = false;
    simulation = simulateScenario(scenario);
    manualTasks = createDefaultManualTasks(simulation.timeline, {
      spreadToMinutes: DAY_MINUTES,
    });
    render();
  };

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
}

function gridToPercentX(x) {
  return ((x + 0.5) / scenario.grid.width) * 100;
}

function gridToPercentY(y) {
  return ((y + 0.5) / scenario.grid.height) * 100;
}

function gridToPoint(point, rect) {
  return {
    x: ((point.x + 0.5) / scenario.grid.width) * rect.width,
    y: ((point.y + 0.5) / scenario.grid.height) * rect.height,
  };
}

function routeColorForWorker(workerId) {
  const index = Number(workerId?.replace("worker-", "")) - 1;
  return routeColors[index % routeColors.length] ?? routeColors[0];
}

function stationForStep(step) {
  if (!step) {
    return undefined;
  }
  const direct = scenario.stations.find((station) => station.id === step.stationId);
  if (direct) {
    return direct;
  }
  return scenario.stations.find((station) => station.type === step.stationType);
}

function stationColor(stationId) {
  if (stationId && colors[stationId]) {
    return colors[stationId];
  }
  const stationIndex = scenario.stations.findIndex((station) => station.id === stationId);
  return fallbackStationColors[Math.max(0, stationIndex) % fallbackStationColors.length];
}

function stationIcon(stationId) {
  const station = scenario.stations.find((item) => item.id === stationId);
  const processIndex = scenario.steps.findIndex(
    (step) => step.stationId === stationId || (station && step.stationType === station.type),
  );
  if (processIndex >= 0) {
    return String(processIndex + 1);
  }
  const stationIndex = scenario.stations.findIndex((item) => item.id === stationId);
  return stationIndex >= 0 ? String(stationIndex + 1) : "设";
}

render();
