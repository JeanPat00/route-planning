export function isPlacedStation(station) {
  return Boolean(station?.position);
}

export function canUseStationForStep(station, step) {
  if (!isPlacedStation(station) || !step) {
    return false;
  }
  return station.id === step.stationId || station.type === step.stationType;
}

export function isMovablePlacedStation(station) {
  return isPlacedStation(station) && !station.fixed;
}
