export function exportScenario(scenario) {
  return JSON.stringify(scenario, null, 2);
}

export function importScenario(serialized) {
  const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  return {
    ...parsed,
    grid: {
      width: Number(parsed.grid?.width ?? 12),
      height: Number(parsed.grid?.height ?? 8),
    },
    blockedCells: Array.isArray(parsed.blockedCells) ? parsed.blockedCells : [],
    stations: Array.isArray(parsed.stations) ? parsed.stations : [],
    steps: Array.isArray(parsed.steps) ? parsed.steps : [],
  };
}

export function saveScenario(storage, key, scenario) {
  storage.setItem(key, exportScenario(scenario));
}

export function loadScenario(storage, key) {
  const serialized = storage.getItem(key);
  return serialized ? importScenario(serialized) : null;
}
