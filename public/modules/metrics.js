export const METRIC_NAMES = Object.freeze({
  temperature: "weather_BME280_temperature",
  humidity: "weather_BME280_humidity",
  pressure: "weather_BME280_pressure",
  pm10: "weather_SDS_P1",
  pm25: "weather_SDS_P2"
});

const METRIC_QUERY = `{__name__=~"${Object.values(METRIC_NAMES).join("|")}"}`;

export function normalizeMetricsBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("VictoriaMetrics must use HTTPS");
  }
  return url.href.replace(/\/$/, "");
}

async function query(baseUrl, path, parameters, signal) {
  const url = new URL(`${normalizeMetricsBaseUrl(baseUrl)}${path}`);
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal
  });
  if (!response.ok) {
    throw new Error(`Metrics request failed with ${response.status}`);
  }
  const payload = await response.json();
  if (payload.status !== "success") {
    throw new Error(payload.error || "Metrics query failed");
  }
  return payload.data;
}

export function currentMetrics(baseUrl, signal) {
  return query(baseUrl, "/api/weather/query", { query: METRIC_QUERY }, signal);
}

export function historyMetrics(baseUrl, period, signal) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - period.seconds;
  return query(
    baseUrl,
    "/api/weather/query_range",
    { query: METRIC_QUERY, start, end, step: period.stepSeconds },
    signal
  );
}

export function vectorToReading(data) {
  const reading = { timestamp: 0 };
  for (const series of data?.result ?? []) {
    const key = Object.entries(METRIC_NAMES).find(
      ([, metricName]) => metricName === series.metric?.__name__
    )?.[0];
    const [timestamp, rawValue] = series.value ?? [];
    if (!key || !Number.isFinite(Number(rawValue))) continue;
    reading[key] = Number(rawValue);
    reading.timestamp = Math.max(reading.timestamp, Number(timestamp) || 0);
  }
  return reading;
}

export function matrixToSeries(data) {
  const result = {};
  for (const series of data?.result ?? []) {
    const key = Object.entries(METRIC_NAMES).find(
      ([, metricName]) => metricName === series.metric?.__name__
    )?.[0];
    if (!key) continue;
    result[key] = (series.values ?? [])
      .map(([timestamp, rawValue]) => ({
        timestamp: Number(timestamp),
        value: Number(rawValue)
      }))
      .filter(
        ({ timestamp, value }) =>
          Number.isFinite(timestamp) && Number.isFinite(value)
      );
  }
  return result;
}

