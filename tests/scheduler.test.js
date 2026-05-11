import test from "node:test";
import assert from "node:assert/strict";

import {
  addStation,
  addStep,
  createDefaultScenario,
  optimizeScenario,
  simulateScenario,
  toggleStationFixed,
  updateStationConfig,
  updateStepConfig,
  updateStartPosition,
  updateStationPosition,
} from "../src/core/scheduler.js";

test("single pizza follows dough, toppings, bake, slice order", () => {
  const scenario = createDefaultScenario({ orders: 1, workers: 1 });
  const result = simulateScenario(scenario);
  const steps = result.timeline.filter((item) => item.orderId === 1);

  assert.deepEqual(
    steps.map((item) => item.stepId),
    ["dough", "toppings", "bake", "slice"],
  );

  for (let index = 1; index < steps.length; index += 1) {
    assert.ok(steps[index].start >= steps[index - 1].end);
  }
});

test("multiple pizzas do not use the same oven capacity at the same time", () => {
  const scenario = createDefaultScenario({ orders: 3, workers: 2 });
  const result = simulateScenario(scenario);
  const ovenTasks = result.timeline.filter((item) => item.stationId === "oven");

  for (let i = 0; i < ovenTasks.length; i += 1) {
    for (let j = i + 1; j < ovenTasks.length; j += 1) {
      const overlaps =
        ovenTasks[i].start < ovenTasks[j].end && ovenTasks[j].start < ovenTasks[i].end;
      assert.equal(overlaps, false);
    }
  }
});

test("layout changes affect travel distance and total duration", () => {
  const scenario = createDefaultScenario({ orders: 2, workers: 1 });
  const baseline = simulateScenario(scenario);
  const compact = updateStationPosition(
    updateStationPosition(
      updateStationPosition(scenario, "doughTable", { x: 8, y: 4 }),
      "toppings",
      { x: 9, y: 4 },
    ),
    "slice",
    { x: 9, y: 5 },
  );
  const compactResult = simulateScenario(compact);

  assert.notEqual(compactResult.metrics.totalDistance, baseline.metrics.totalDistance);
  assert.notEqual(compactResult.metrics.totalDuration, baseline.metrics.totalDuration);
  assert.notEqual(compactResult.metrics.score, baseline.metrics.score);
});

test("optimizer keeps fixed stations in place and returns ranked candidates", () => {
  const scenario = createDefaultScenario({ orders: 4, workers: 2 });
  const result = optimizeScenario(scenario);
  const oven = scenario.stations.find((station) => station.id === "oven");

  assert.equal(result.candidates.length, 3);
  assert.deepEqual(
    result.recommended.stations.find((station) => station.id === "oven").position,
    oven.position,
  );
  assert.ok(result.candidates[0].metrics.score >= result.candidates[1].metrics.score);
});

test("optimizer candidates do not overlap stations", () => {
  const result = optimizeScenario(createDefaultScenario({ orders: 4, workers: 2 }));

  for (const candidate of result.candidates) {
    const positions = candidate.scenario.stations.map(
      (station) => `${station.position.x}-${station.position.y}`,
    );
    assert.equal(new Set(positions).size, positions.length);
  }
});

test("worker routes include the configured start point and worker identity", () => {
  const scenario = {
    ...createDefaultScenario({ orders: 1, workers: 1 }),
    startPosition: { x: 2, y: 7 },
  };
  const result = simulateScenario(scenario);

  assert.deepEqual(result.paths[0].from, { x: 2, y: 7 });
  assert.equal(result.paths[0].workerId, "worker-1");
  assert.equal(result.paths[0].workerLabel, "员工 1");
});

test("worker routes avoid blocked cells", () => {
  const scenario = createDefaultScenario({ orders: 1, workers: 1 });
  const result = simulateScenario(scenario);
  const blocked = new Set(scenario.blockedCells.map((cell) => `${cell.x}-${cell.y}`));

  for (const path of result.paths) {
    for (const point of path.points) {
      assert.equal(blocked.has(`${point.x}-${point.y}`), false);
    }
  }
});

test("locked stations cannot move until unlocked and start avoids blocked cells", () => {
  const scenario = createDefaultScenario();
  const lockedMove = updateStationPosition(scenario, "oven", { x: 3, y: 3 });
  const unlocked = toggleStationFixed(scenario, "oven");
  const unlockedMove = updateStationPosition(unlocked, "oven", { x: 3, y: 3 });
  const blockedStart = updateStartPosition(scenario, { x: 5, y: 3 });

  assert.deepEqual(
    lockedMove.stations.find((station) => station.id === "oven").position,
    { x: 10, y: 6 },
  );
  assert.deepEqual(
    unlockedMove.stations.find((station) => station.id === "oven").position,
    { x: 3, y: 3 },
  );
  assert.notDeepEqual(blockedStart.startPosition, { x: 5, y: 3 });
});

test("station capacity and process time can be edited", () => {
  const scenario = updateStationConfig(createDefaultScenario(), "oven", {
    label: "双层烤箱",
    capacity: 2,
    processTime: 18,
  });
  const oven = scenario.stations.find((station) => station.id === "oven");

  assert.equal(oven.label, "双层烤箱");
  assert.equal(oven.capacity, 2);
  assert.equal(oven.processTime, 18);
});

test("new stations can be added with normalized defaults", () => {
  const scenario = addStation(createDefaultScenario(), {
    label: "发酵柜",
    type: "proof",
    position: { x: 5, y: 3 },
    capacity: 0,
    processTime: 0,
  });
  const added = scenario.stations.at(-1);

  assert.equal(added.label, "发酵柜");
  assert.equal(added.capacity, 1);
  assert.equal(added.processTime, 1);
  assert.notDeepEqual(added.position, { x: 5, y: 3 });
});

test("new stations can remain in the library until placed", () => {
  const scenario = addStation(createDefaultScenario({ orders: 1, workers: 1 }), {
    label: "备用切片台",
    type: "slice",
    capacity: 1,
    processTime: 4,
  });
  const added = scenario.stations.at(-1);
  const result = simulateScenario(scenario);

  assert.equal(added.position, undefined);
  assert.equal(result.timeline.some((item) => item.stationId === added.id), false);
});

test("steps can bind by station type and choose among placed devices", () => {
  const withSecondSlice = addStation(createDefaultScenario({ orders: 2, workers: 2 }), {
    label: "第二切片台",
    type: "slice",
    position: { x: 9, y: 6 },
    capacity: 1,
    processTime: 1,
  });
  const sliceStep = withSecondSlice.steps.find((step) => step.id === "slice");
  const typedScenario = updateStepConfig(withSecondSlice, sliceStep.id, {
    label: sliceStep.label,
    stationId: "slice",
  });
  const result = simulateScenario(typedScenario);
  const sliceStations = new Set(
    result.timeline.filter((item) => item.stepId === "slice").map((item) => item.stationId),
  );

  assert.ok(sliceStations.has(withSecondSlice.stations.at(-1).id));
});
