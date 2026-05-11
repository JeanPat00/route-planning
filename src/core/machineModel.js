import { environmentEfficiencyFactor } from "./environmentModel.js";

export const DEFAULT_MACHINE_PROFILE = {
  health: 1,
  loadEfficiency: 1,
  dailyEfficiency: 1,
};

export function normalizeMachineProfile(profile = {}) {
  return {
    health: normalizeRatio(profile.health, DEFAULT_MACHINE_PROFILE.health),
    loadEfficiency: normalizeRatio(profile.loadEfficiency, DEFAULT_MACHINE_PROFILE.loadEfficiency),
    dailyEfficiency: normalizeRatio(profile.dailyEfficiency, DEFAULT_MACHINE_PROFILE.dailyEfficiency),
  };
}

export function estimateStationProcessTime(station, environment = {}) {
  const profile = normalizeMachineProfile(station.machineProfile);
  const efficiency = Math.max(
    0.1,
    profile.health * profile.loadEfficiency * profile.dailyEfficiency,
  );
  return round((station.processTime * environmentEfficiencyFactor(environment)) / efficiency);
}

function normalizeRatio(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(Math.max(number, 0.1), 2);
}

function round(value) {
  return Math.round(value * 10) / 10;
}
