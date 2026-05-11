import { isMovablePlacedStation } from "../constraints.js";

export function runHeuristicOptimization(scenario, helpers) {
  const { applyLayout, simulateScenario } = helpers;
  const candidates = [
    candidate(
      "fastest",
      "最快方案",
      applyLayout(scenario, sequencedPositions(scenario, "compact")),
    ),
    candidate(
      "least-walk",
      "最少移动",
      applyLayout(scenario, sequencedPositions(scenario, "near-start")),
    ),
    candidate(
      "balanced",
      "均衡方案",
      applyLayout(scenario, sequencedPositions(scenario, "spread")),
    ),
  ]
    .map((item) => ({ ...item, ...simulateScenario(item.scenario) }))
    .sort((a, b) => b.metrics.score - a.metrics.score);

  return {
    original: simulateScenario(scenario),
    recommended: candidates[0].scenario,
    candidates,
  };
}

export function sequencedPositions(scenario, mode) {
  const movableStations = scenario.stations.filter(isMovablePlacedStation);
  const stepStationIds = [
    ...new Set(
      scenario.steps
        .map((step) => step.stationId)
        .filter((stationId) =>
          movableStations.some((station) => station.id === stationId),
        ),
    ),
  ];
  const orderedStations = [
    ...stepStationIds
      .map((stationId) => movableStations.find((station) => station.id === stationId))
      .filter(Boolean),
    ...movableStations.filter((station) => !stepStationIds.includes(station.id)),
  ];
  const positions = {};
  const count = Math.max(orderedStations.length - 1, 1);

  orderedStations.forEach((station, index) => {
    positions[station.id] = positionForMode(scenario, mode, index, count);
  });

  return positions;
}

function candidate(id, label, scenario) {
  return { id, label, scenario };
}

function positionForMode(scenario, mode, index, count) {
  const width = scenario.grid.width;
  const height = scenario.grid.height;
  if (mode === "near-start") {
    return {
      x: Math.min(width - 1, Math.max(0, scenario.startPosition.x + 1 + index)),
      y: Math.min(height - 1, Math.max(0, scenario.startPosition.y)),
    };
  }
  if (mode === "spread") {
    return {
      x: Math.round(1 + ((width - 3) * index) / count),
      y: index % 2 === 0 ? 1 : height - 2,
    };
  }
  return {
    x: Math.round(width * 0.35 + (index % 3)),
    y: Math.round(height * 0.35 + Math.floor(index / 3)),
  };
}
