export function createDefaultManualTasks(timeline, options = {}) {
  const items = timeline
    .filter((item) => item.workerId?.startsWith("worker-"))
    .map((item) => ({ ...item }));
  const totalEnd = Math.max(...items.map((item) => item.end), 1);
  const scale = options.spreadToMinutes ? options.spreadToMinutes / totalEnd : 1;

  return items.map((item) => ({
      id: `default-${item.id}`,
      stepId: item.stepId,
      stepLabel: item.stepLabel,
      stationId: item.stationId,
      stationLabel: item.stationLabel,
      workerId: item.workerId,
      start: round(item.start * scale),
      duration: Math.max(1, round(item.duration * scale)),
      end: round(item.end * scale),
    }));
}

export function createManualTask(tasks, step, workerId, start, maxTime, snapSize = 5) {
  const task = normalizeTask(
    {
      id: `manual-${Date.now()}-${tasks.length + 1}`,
      stepId: step.id,
      stepLabel: step.label,
      stationId: step.stationId,
      stationLabel: step.stationLabel,
      workerId,
      start,
      duration: step.duration,
    },
    maxTime,
    snapSize,
  );

  return [...tasks, task];
}

export function moveManualTask(tasks, taskId, workerId, start, maxTime, snapSize = 5) {
  return tasks.map((task) =>
    task.id === taskId
      ? normalizeTask({ ...task, workerId, start }, maxTime, snapSize)
      : task,
  );
}

export function removeManualTask(tasks, taskId) {
  return tasks.filter((task) => task.id !== taskId);
}

export function reconcileManualTasks(tasks, workerCount, maxTime, snapSize = 5) {
  const validWorkers = new Set(
    Array.from({ length: workerCount }, (_, index) => `worker-${index + 1}`),
  );

  return tasks
    .filter((task) => validWorkers.has(task.workerId))
    .map((task) => normalizeTask(task, maxTime, snapSize));
}

export function getManualScheduleSummary(tasks) {
  const totalDuration = tasks.reduce((sum, task) => sum + task.duration, 0);
  const workerCount = new Set(tasks.map((task) => task.workerId)).size;
  return { taskCount: tasks.length, totalDuration, workerCount };
}

function normalizeTask(task, maxTime, snapSize) {
  const duration = Math.max(1, Number(task.duration));
  const latestStart = Math.max(0, maxTime - duration);
  const start = Math.min(Math.max(0, snap(Number(task.start), snapSize)), latestStart);

  return {
    ...task,
    start,
    duration,
    end: start + duration,
  };
}

function snap(value, snapSize) {
  return Math.round(value / snapSize) * snapSize;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
