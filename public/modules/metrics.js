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

function metricKey(metric = {}) {
  return JSON.stringify(
    Object.entries(metric).sort(([left], [right]) => left.localeCompare(right))
  );
}

export function mergeCurrentIntoHistory(history, current) {
  const result = (history?.result ?? []).map((series) => ({
    ...series,
    metric: { ...series.metric },
    values: [...(series.values ?? [])]
  }));
  const byMetric = new Map(result.map((series) => [metricKey(series.metric), series]));

  for (const series of current?.result ?? []) {
    const [timestamp, value] = series.value ?? [];
    if (!Number.isFinite(Number(timestamp)) || !Number.isFinite(Number(value))) continue;
    const key = metricKey(series.metric);
    let target = byMetric.get(key);
    if (!target) {
      target = { metric: { ...series.metric }, values: [] };
      byMetric.set(key, target);
      result.push(target);
    }
    const lastTimestamp = Number(target.values.at(-1)?.[0] ?? -Infinity);
    if (Number(timestamp) > lastTimestamp) target.values.push([timestamp, value]);
  }

  return { ...history, result };
}

export async function historyMetrics(baseUrl, period, signal) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - period.seconds;
  const [history, current] = await Promise.all([
    query(
      baseUrl,
      "/api/weather/query_range",
      { query: METRIC_QUERY, start, end, step: period.stepSeconds },
      signal
    ),
    currentMetrics(baseUrl, signal)
  ]);
  return mergeCurrentIntoHistory(history, current);
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
