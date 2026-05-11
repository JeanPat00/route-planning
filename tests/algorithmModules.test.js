import test from "node:test";
import assert from "node:assert/strict";

import { canUseStationForStep } from "../src/core/constraints.js";
import { normalizeEnvironment } from "../src/core/environmentModel.js";
import { estimateStationProcessTime } from "../src/core/machineModel.js";
import { scoreMetrics } from "../src/core/objective.js";
import { sequencedPositions } from "../src/core/solvers/heuristicOptimizer.js";
import { createPizzaKitchenScenario } from "../src/core/scenarioTemplates.js";

test("objective scoring remains compatible with the current optimizer", () => {
  const stationLoads = [
    { wait: 3, utilization: 0.5 },
    { wait: 2, utilization: 0.8 },
  ];

  assert.equal(scoreMetrics(10, 20, stationLoads), 1000 - 10 * 8 - 20 * 2 - 5 * 3);
});

test("machine and environment models have neutral defaults", () => {
  const station = { processTime: 18 };

  assert.deepEqual(normalizeEnvironment(), { humidity: null, temperature: null });
  assert.equal(estimateStationProcessTime(station), 18);
});

test("constraints and heuristic solver expose reusable algorithm boundaries", () => {
  const scenario = createPizzaKitchenScenario();
  const doughStation = scenario.stations.find((station) => station.id === "doughTable");
  const doughStep = scenario.steps.find((step) => step.id === "dough");
  const unplacedStation = { ...doughStation, id: "library-dough", position: undefined };
  const positions = sequencedPositions(scenario, "near-start");

  assert.equal(canUseStationForStep(doughStation, doughStep), true);
  assert.equal(canUseStationForStep(unplacedStation, doughStep), false);
  assert.deepEqual(positions.doughTable, { x: 1, y: 0 });
});
