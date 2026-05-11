import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultManualTasks,
  createManualTask,
  getManualScheduleSummary,
  moveManualTask,
  reconcileManualTasks,
  removeManualTask,
} from "../src/core/manualSchedule.js";

const step = {
  id: "toppings",
  label: "铺辅料",
  stationId: "toppings",
  stationLabel: "辅料区",
  duration: 6,
};

test("creates a snapped manual task on a worker row", () => {
  const tasks = createManualTask([], step, "worker-1", 13, 60);

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].workerId, "worker-1");
  assert.equal(tasks[0].start, 15);
  assert.equal(tasks[0].end, 21);
});

test("creates editable default tasks from simulated worker timeline", () => {
  const tasks = createDefaultManualTasks([
    {
      id: "1-dough",
      stepId: "dough",
      stepLabel: "制作面饼",
      stationId: "doughTable",
      stationLabel: "面饼台",
      workerId: "worker-1",
      start: 4,
      end: 12,
      duration: 8,
    },
  ]);

  assert.deepEqual(tasks[0], {
    id: "default-1-dough",
    stepId: "dough",
    stepLabel: "制作面饼",
    stationId: "doughTable",
    stationLabel: "面饼台",
    workerId: "worker-1",
    start: 4,
    duration: 8,
    end: 12,
  });
});

test("can spread default tasks across a 24 hour timeline", () => {
  const tasks = createDefaultManualTasks([
    {
      id: "1-dough",
      stepId: "dough",
      stepLabel: "制作面饼",
      stationId: "doughTable",
      stationLabel: "面饼台",
      workerId: "worker-1",
      start: 0,
      end: 10,
      duration: 10,
    },
    {
      id: "1-slice",
      stepId: "slice",
      stepLabel: "取出切片",
      stationId: "slice",
      stationLabel: "切片台",
      workerId: "worker-1",
      start: 10,
      end: 20,
      duration: 10,
    },
  ], { spreadToMinutes: 24 * 60 });

  assert.equal(tasks[0].start, 0);
  assert.equal(tasks[0].end, 720);
  assert.equal(tasks[1].start, 720);
  assert.equal(tasks[1].end, 1440);
});

test("moves a manual task between worker rows and clamps it within the timeline", () => {
  const [task] = createManualTask([], step, "worker-1", 10, 60);
  const tasks = moveManualTask([task], task.id, "worker-2", 58, 60);

  assert.equal(tasks[0].workerId, "worker-2");
  assert.equal(tasks[0].start, 54);
  assert.equal(tasks[0].end, 60);
});

test("removes tasks and reports a summary", () => {
  const tasks = createManualTask([], step, "worker-1", 10, 60);
  const summary = getManualScheduleSummary(tasks);

  assert.deepEqual(summary, { taskCount: 1, totalDuration: 6, workerCount: 1 });
  assert.deepEqual(removeManualTask(tasks, tasks[0].id), []);
});

test("reconciles hidden worker tasks and clamps tasks after timeline changes", () => {
  const first = createManualTask([], step, "worker-1", 10, 60);
  const second = createManualTask(first, step, "worker-3", 55, 60);
  const reconciled = reconcileManualTasks(second, 2, 40);

  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].workerId, "worker-1");
  assert.equal(reconciled[0].end <= 40, true);
});

test("can snap manual task placement to hour grid cells", () => {
  const tasks = createManualTask([], step, "worker-1", 74, 24 * 60, 60);

  assert.equal(tasks[0].start, 60);
  assert.equal(tasks[0].end, 66);
});
