export const DEFAULT_ENVIRONMENT = {
  humidity: null,
  temperature: null,
};

export function normalizeEnvironment(environment = {}) {
  return {
    humidity: normalizeNullableNumber(environment.humidity),
    temperature: normalizeNullableNumber(environment.temperature),
  };
}

export function environmentEfficiencyFactor(environment = {}) {
  const normalized = normalizeEnvironment(environment);
  const humidityPenalty =
    normalized.humidity === null ? 1 : 1 + Math.max(0, normalized.humidity - 70) / 200;
  const temperaturePenalty =
    normalized.temperature === null
      ? 1
      : 1 + Math.max(0, Math.abs(normalized.temperature - 24) - 6) / 100;

  return humidityPenalty * temperaturePenalty;
}

function normalizeNullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
