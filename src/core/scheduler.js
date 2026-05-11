import { optimizeScenario as runOptimization } from "./optimizer.js";
import { canUseStationForStep } from "./constraints.js";
import { estimateStationProcessTime } from "./machineModel.js";
import { scoreMetrics } from "./objective.js";
import { createPizzaKitchenScenario } from "./scenarioTemplates.js";

const GRID = { width: 12, height: 8 };
let nextStationNumber = 1;
let nextStepNumber = 1;

export function createDefaultScenario(overrides = {}) {
  return createPizzaKitchenScenario(overrides);
}

export function updateStationPosition(scenario, stationId, position) {
  return {
    ...scenario,
    stations: scenario.stations.map((stationItem) =>
      stationItem.id === stationId
        ? {
            ...stationItem,
            position: stationItem.fixed
              ? stationItem.position
              : normalizeOpenPosition(position, scenario),
          }
        : stationItem,
    ),
  };
}

export function updateStartPosition(scenario, position) {
  return {
    ...scenario,
    startPosition: normalizeOpenPosition(position, scenario),
  };
}

export function updateStationConfig(scenario, stationId, config) {
  const target = scenario.stations.find((stationItem) => stationItem.id === stationId);
  const nextType = normalizeLabel(config.type, target?.type ?? "custom");
  return {
    ...scenario,
    stations: scenario.stations.map((stationItem) =>
      stationItem.id === stationId
        ? {
            ...stationItem,
            label: normalizeLabel(config.label, stationItem.label),
            type: nextType,
            capacity: normalizePositiveInteger(config.capacity, stationItem.capacity),
            processTime: normalizePositiveInteger(config.processTime, stationItem.processTime),
          }
        : stationItem,
    ),
    steps: scenario.steps.map((stepItem) =>
      stepItem.stationId === stationId ? { ...stepItem, stationType: nextType } : stepItem,
    ),
  };
}

export function addStation(scenario, config = {}) {
  const label = normalizeLabel(config.label, `新设备 ${nextStationNumber}`);
  const type = normalizeLabel(config.type, "custom");
  const id = uniqueStationId(scenario, type);
  nextStationNumber += 1;

  return {
    ...scenario,
    stations: [
      ...scenario.stations,
      station(
        id,
        label,
        type,
        config.position ? normalizeOpenPosition(config.position, scenario) : undefined,
        normalizePositiveInteger(config.capacity, 1),
        normalizePositiveInteger(config.processTime, 10),
        { custom: true },
      ),
    ],
  };
}

export function removeStation(scenario, stationId) {
  if (scenario.steps.some((stepItem) => stepItem.stationId === stationId)) {
    return { scenario, removed: false, reason: "station-in-use" };
  }
  return {
    scenario: {
      ...scenario,
      stations: scenario.stations.filter((stationItem) => stationItem.id !== stationId),
    },
    removed: true,
  };
}

export function addStep(scenario, config = {}) {
  const stationId = config.stationId ?? scenario.stations[0]?.id;
  const selectedStation = scenario.stations.find((stationItem) => stationItem.id === stationId);
  if (!selectedStation) {
    return scenario;
  }
  const label = normalizeLabel(config.label, `新工序 ${nextStepNumber}`);
  const id = uniqueStepId(scenario, label);
  nextStepNumber += 1;
  return {
    ...scenario,
    steps: [
      ...scenario.steps,
      {
        id,
        label,
        stationId: selectedStation.id,
        stationType: config.stationType ?? selectedStation.type,
        durationMode: "station",
      },
    ],
  };
}

export function updateStepConfig(scenario, stepId, config = {}) {
  const selectedStation = scenario.stations.find((stationItem) => stationItem.id === config.stationId);
  return {
    ...scenario,
    steps: scenario.steps.map((stepItem) =>
      stepItem.id === stepId
        ? {
            ...stepItem,
            label: normalizeLabel(config.label, stepItem.label),
            stationId: selectedStation?.id ?? stepItem.stationId,
            stationType: selectedStation?.type ?? config.stationType ?? stepItem.stationType,
            durationMode: config.durationMode ?? stepItem.durationMode ?? "station",
          }
        : stepItem,
    ),
  };
}

export function removeStep(scenario, stepId) {
  if (scenario.steps.length <= 1) {
    return scenario;
  }
  return {
    ...scenario,
    steps: scenario.steps.filter((stepItem) => stepItem.id !== stepId),
  };
}

export function reorderStep(scenario, fromIndex, toIndex) {
  const steps = [...scenario.steps];
  const [item] = steps.splice(fromIndex, 1);
  if (!item) {
    return scenario;
  }
  steps.splice(Math.min(Math.max(toIndex, 0), steps.length), 0, item);
  return { ...scenario, steps };
}

export function updateGrid(scenario, grid) {
  const width = normalizePositiveInteger(grid.width, scenario.grid.width);
  const height = normalizePositiveInteger(grid.height, scenario.grid.height);
  const nextScenario = {
    ...scenario,
    grid: { width, height },
    blockedCells: scenario.blockedCells
      .map((cell) => clampPosition(cell, { width, height }))
      .filter(uniqueCells),
  };
  return {
    ...nextScenario,
    startPosition: normalizeOpenPosition(scenario.startPosition, nextScenario),
    stations: scenario.stations.map((stationItem) => ({
      ...stationItem,
      position: stationItem.position
        ? normalizeOpenPosition(stationItem.position, nextScenario)
        : undefined,
    })),
  };
}

export function toggleBlockedCell(scenario, position) {
  const cell = clampPosition(position, scenario.grid);
  const key = cellKey(cell);
  const blocked = new Set(scenario.blockedCells.map(cellKey));
  if (blocked.has(key)) {
    return {
      ...scenario,
      blockedCells: scenario.blockedCells.filter((item) => cellKey(item) !== key),
    };
  }
  if (cellKey(scenario.startPosition) === key) {
    return scenario;
  }
  if (
    scenario.stations.some(
      (stationItem) => stationItem.position && cellKey(stationItem.position) === key,
    )
  ) {
    return scenario;
  }
  return {
    ...scenario,
    blockedCells: [...scenario.blockedCells, cell],
  };
}

export function toggleStationFixed(scenario, stationId) {
  return {
    ...scenario,
    stations: scenario.stations.map((stationItem) =>
      stationItem.id === stationId ? { ...stationItem, fixed: !stationItem.fixed } : stationItem,
    ),
  };
}

export function simulateScenario(scenario) {
  const workers = Array.from({ length: scenario.workerCount }, (_, index) => ({
    id: `worker-${index + 1}`,
    label: `员工 ${index + 1}`,
    availableAt: 0,
    position: { ...(scenario.startPosition ?? { x: 0, y: 0 }) },
    distance: 0,
  }));
  const placedStations = scenario.stations.filter((stationItem) => stationItem.position);
  const stationSlots = new Map(
    placedStations.map((stationItem) => [
      stationItem.id,
      Array.from({ length: stationItem.capacity }, () => 0),
    ]),
  );
  const stationWait = new Map(scenario.stations.map((stationItem) => [stationItem.id, 0]));
  const timeline = [];
  const paths = [];

  for (let orderId = 1; orderId <= scenario.orders; orderId += 1) {
    let readyAt = 0;

    for (const stepItem of scenario.steps) {
      const candidates = resolveStepStations(scenario, stepItem);
      if (candidates.length === 0) {
        continue;
      }
      const assignment = chooseAssignment({
        workers,
        candidates,
        stationSlots,
        scenario,
        readyAt,
        speed: scenario.workerSpeed,
      });
      const stationItem = assignment.station;
      const processTime = estimateStationProcessTime(stationItem, scenario.environment);

      const start = assignment.start;
      const end = start + processTime;
      const wait = Math.max(0, start - readyAt - assignment.travelTime);

      assignment.worker.availableAt = end;
      assignment.worker.position = { ...stationItem.position };
      assignment.worker.distance += assignment.distance;
      stationSlots.get(stationItem.id)[assignment.slotIndex] = end;
      stationWait.set(stationItem.id, stationWait.get(stationItem.id) + wait);
      readyAt = end;

      timeline.push({
        id: `${orderId}-${stepItem.id}`,
        orderId,
        stepId: stepItem.id,
        stepLabel: stepItem.label,
        stationId: stationItem.id,
        stationLabel: stationItem.label,
        workerId: assignment.worker.id,
        workerLabel: assignment.worker.label,
        start: round(start),
        end: round(end),
        duration: processTime,
        wait: round(wait),
        distance: round(assignment.distance),
      });
      paths.push({
        orderId,
        stepId: stepItem.id,
        workerId: assignment.worker.id,
        workerLabel: assignment.worker.label,
        from: assignment.from,
        to: stationItem.position,
        points: assignment.points,
        distance: round(assignment.distance),
      });
    }
  }

  const totalDuration = Math.max(...timeline.map((item) => item.end), 0);
  const totalDistance = workers.reduce((sum, worker) => sum + worker.distance, 0);
  const stationLoads = scenario.stations.map((stationItem) => {
    const busyTime = timeline
      .filter((item) => item.stationId === stationItem.id)
      .reduce((sum, item) => sum + item.duration, 0);
    const wait = stationWait.get(stationItem.id);
    return {
      stationId: stationItem.id,
      label: stationItem.label,
      busyTime: round(busyTime),
      wait: round(wait),
      utilization: totalDuration ? round(busyTime / (totalDuration * stationItem.capacity)) : 0,
    };
  });
  const bottleneck = [...stationLoads].sort(
    (a, b) => b.wait + b.utilization * 10 - (a.wait + a.utilization * 10),
  )[0];

  return {
    scenario,
    timeline,
    paths,
    metrics: {
      totalDuration: round(totalDuration),
      totalDistance: round(totalDistance),
      stationWait: round([...stationWait.values()].reduce((sum, wait) => sum + wait, 0)),
      ovenUtilization:
        stationLoads.find((item) => item.stationId === "oven")?.utilization ?? 0,
      bottleneck,
      score: scoreMetrics(totalDuration, totalDistance, stationLoads),
      stationLoads,
    },
  };
}

export function optimizeScenario(scenario) {
  return runOptimization(scenario, {
    applyLayout,
    simulateScenario,
    nearestCorner,
  });
}

function station(id, label, type, position, capacity, processTime, options = {}) {
  return { id, label, type, position, capacity, processTime, ...options };
}

function uniqueStationId(scenario, type) {
  const base = type.replace(/[^a-z0-9]+/gi, "").toLowerCase() || "station";
  let index = 1;
  let id = `${base}-${index}`;
  const ids = new Set(scenario.stations.map((stationItem) => stationItem.id));

  while (ids.has(id)) {
    index += 1;
    id = `${base}-${index}`;
  }

  return id;
}

function uniqueStepId(scenario, label) {
  const base = label.replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "").toLowerCase() || "step";
  let index = 1;
  let id = `${base}-${index}`;
  const ids = new Set(scenario.steps.map((stepItem) => stepItem.id));
  while (ids.has(id)) {
    index += 1;
    id = `${base}-${index}`;
  }
  return id;
}

function step(id, label, stationId) {
  return { id, label, stationId, stationType: undefined, durationMode: "station" };
}

function resolveStepStations(scenario, stepItem) {
  const preferred = scenario.stations.find((stationItem) => stationItem.id === stepItem.stationId);
  const normalizedStep = {
    ...stepItem,
    stationType: stepItem.stationType ?? preferred?.type,
  };
  const candidates = scenario.stations.filter((stationItem) =>
    canUseStationForStep(stationItem, normalizedStep),
  );

  if (preferred?.position && !candidates.some((stationItem) => stationItem.id === preferred.id)) {
    candidates.unshift(preferred);
  }

  return candidates;
}

function chooseAssignment({ workers, stationSlots, candidates, scenario, readyAt, speed }) {
  let best = null;

  for (const station of candidates) {
    const slots = stationSlots.get(station.id);
    if (!slots) {
      continue;
    }
    for (const worker of workers) {
      const route = findPath(worker.position, station.position, scenario);
      const distance = route.length - 1;
      const travelTime = distance / speed;
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const start = Math.max(readyAt, worker.availableAt + travelTime, slots[slotIndex]);
        const end = start + estimateStationProcessTime(station, scenario.environment);
        if (!best || end < best.end || (end === best.end && distance < best.distance)) {
          best = {
            worker,
            station,
            slotIndex,
            start,
            end,
            distance,
            travelTime,
            from: { ...worker.position },
            points: route,
          };
        }
      }
    }
  }

  return best;
}

function applyLayout(scenario, positions) {
  const occupied = new Set(
    scenario.stations
      .filter((stationItem) => stationItem.position && (stationItem.fixed || !positions[stationItem.id]))
      .map((stationItem) => cellKey(stationItem.position)),
  );

  return {
    ...scenario,
    stations: scenario.stations.map((stationItem) => {
      if (stationItem.fixed || !positions[stationItem.id]) {
        return {
          ...stationItem,
          position: stationItem.position ? { ...stationItem.position } : undefined,
        };
      }
      const nextPosition = stationItem.cornerOnly
        ? nearestCorner(positions[stationItem.id], scenario.grid)
        : positions[stationItem.id];
      const position = normalizeOpenUnoccupiedPosition(nextPosition, scenario, occupied);
      occupied.add(cellKey(position));
      return { ...stationItem, position };
    }),
  };
}

function nearestCorner(position, grid) {
  const corners = [
    { x: 1, y: 1 },
    { x: grid.width - 2, y: 1 },
    { x: 1, y: grid.height - 2 },
    { x: grid.width - 2, y: grid.height - 2 },
  ];
  return corners.sort((a, b) => manhattan(position, a) - manhattan(position, b))[0];
}

function clampPosition(position, grid) {
  return {
    x: Math.min(Math.max(Math.round(position.x), 0), grid.width - 1),
    y: Math.min(Math.max(Math.round(position.y), 0), grid.height - 1),
  };
}

function normalizeOpenPosition(position, scenario) {
  const clamped = clampPosition(position, scenario.grid);
  if (!isBlocked(clamped, scenario)) {
    return clamped;
  }

  const openCells = [];
  for (let y = 0; y < scenario.grid.height; y += 1) {
    for (let x = 0; x < scenario.grid.width; x += 1) {
      const cell = { x, y };
      if (!isBlocked(cell, scenario)) {
        openCells.push(cell);
      }
    }
  }

  return openCells.sort((a, b) => manhattan(clamped, a) - manhattan(clamped, b))[0] ?? clamped;
}

function normalizeOpenUnoccupiedPosition(position, scenario, occupied) {
  const preferred = normalizeOpenPosition(position, scenario);
  if (!occupied.has(cellKey(preferred))) {
    return preferred;
  }

  const openCells = [];
  for (let y = 0; y < scenario.grid.height; y += 1) {
    for (let x = 0; x < scenario.grid.width; x += 1) {
      const cell = { x, y };
      if (!isBlocked(cell, scenario) && !occupied.has(cellKey(cell))) {
        openCells.push(cell);
      }
    }
  }

  return openCells.sort((a, b) => manhattan(preferred, a) - manhattan(preferred, b))[0] ?? preferred;
}

function findPath(start, end, scenario) {
  const normalizedStart = normalizeOpenPosition(start, scenario);
  const normalizedEnd = normalizeOpenPosition(end, scenario);
  const queue = [normalizedStart];
  const visited = new Set([cellKey(normalizedStart)]);
  const previous = new Map();

  while (queue.length > 0) {
    const current = queue.shift();
    if (cellKey(current) === cellKey(normalizedEnd)) {
      return reconstructPath(previous, normalizedStart, normalizedEnd);
    }

    for (const next of neighbors(current, scenario)) {
      const key = cellKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        previous.set(key, current);
        queue.push(next);
      }
    }
  }

  return [normalizedStart, normalizedEnd];
}

function reconstructPath(previous, start, end) {
  const path = [end];
  let current = end;

  while (cellKey(current) !== cellKey(start)) {
    current = previous.get(cellKey(current));
    if (!current) {
      return [start, end];
    }
    path.unshift(current);
  }

  return path;
}

function neighbors(cell, scenario) {
  return [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ].filter(
    (next) =>
      next.x >= 0 &&
      next.x < scenario.grid.width &&
      next.y >= 0 &&
      next.y < scenario.grid.height &&
      !isBlocked(next, scenario),
  );
}

function isBlocked(position, scenario) {
  return scenario.blockedCells.some((cell) => cell.x === position.x && cell.y === position.y);
}

function cellKey(position) {
  return `${position.x}-${position.y}`;
}

function uniqueCells(cell, index, cells) {
  return cells.findIndex((item) => item.x === cell.x && item.y === cell.y) === index;
}

function normalizeLabel(value, fallback) {
  const label = String(value ?? "").trim();
  return label || fallback;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(1, Math.round(number));
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function round(value) {
  return Math.round(value * 10) / 10;
}
