export const DEFAULT_SCORE_WEIGHTS = {
  baseline: 1000,
  duration: 8,
  distance: 2,
  wait: 3,
};

export function scoreMetrics(totalDuration, totalDistance, stationLoads, weights = DEFAULT_SCORE_WEIGHTS) {
  const wait = stationLoads.reduce((sum, item) => sum + item.wait, 0);
  return round(
    weights.baseline -
      totalDuration * weights.duration -
      totalDistance * weights.distance -
      wait * weights.wait,
  );
}

function round(value) {
  return Math.round(value * 10) / 10;
}
