import test from "node:test";
import assert from "node:assert/strict";

import { createBakeryFactoryScenario, createPizzaKitchenScenario } from "../src/core/scenarioTemplates.js";
import { exportScenario, importScenario } from "../src/core/scenarioStore.js";
import {
  addStep,
  removeStation,
  reorderStep,
  simulateScenario,
  toggleBlockedCell,
  updateGrid,
  updateStepConfig,
} from "../src/core/scheduler.js";

test("pizza and bakery templates simulate successfully", () => {
  for (const scenario of [createPizzaKitchenScenario(), createBakeryFactoryScenario()]) {
    const result = simulateScenario(scenario);

    assert.equal(typeof scenario.name, "string");
    assert.ok(scenario.stations.length >= 4);
    assert.ok(scenario.steps.length >= 4);
    assert.ok(result.timeline.length > 0);
    assert.ok(result.metrics.bottleneck);
  }
});

test("steps can be added, edited, reordered, and simulated", () => {
  const base = createBakeryFactoryScenario();
  const withStep = addStep(base, {
    label: "质检",
    stationId: base.stations.at(-1).id,
  });
  const edited = updateStepConfig(withStep, withStep.steps.at(-1).id, {
    label: "终检",
    stationId: base.stations[0].id,
  });
  const reordered = reorderStep(edited, edited.steps.length - 1, 0);
  const result = simulateScenario(reordered);

  assert.equal(reordered.steps[0].label, "终检");
  assert.equal(result.timeline[0].stepLabel, "终检");
});

test("station removal is blocked while a step references the station", () => {
  const scenario = createPizzaKitchenScenario();
  const referenced = removeStation(scenario, "oven");
  const unreferenced = removeStation(
    {
      ...scenario,
      steps: scenario.steps.filter((step) => step.stationId !== "oven"),
    },
    "oven",
  );

  assert.equal(referenced.removed, false);
  assert.equal(unreferenced.removed, true);
  assert.equal(unreferenced.scenario.stations.some((station) => station.id === "oven"), false);
});

test("grid and blocked cells are editable without creating invalid routes", () => {
  const scenario = toggleBlockedCell(updateGrid(createPizzaKitchenScenario(), { width: 14, height: 10 }), {
    x: 3,
    y: 3,
  });
  const result = simulateScenario(scenario);
  const blocked = new Set(scenario.blockedCells.map((cell) => `${cell.x}-${cell.y}`));

  assert.deepEqual(scenario.grid, { width: 14, height: 10 });
  assert.equal(blocked.has("3-3"), true);
  for (const path of result.paths) {
    for (const point of path.points) {
      assert.equal(blocked.has(`${point.x}-${point.y}`), false);
    }
  }
});

test("scenario export and import preserve editable data", () => {
  const scenario = createBakeryFactoryScenario();
  const imported = importScenario(exportScenario(scenario));

  assert.deepEqual(imported.grid, scenario.grid);
  assert.deepEqual(imported.blockedCells, scenario.blockedCells);
  assert.deepEqual(imported.steps, scenario.steps);
  assert.deepEqual(imported.stations, scenario.stations);
});
