export const WEATHER_CODES = Object.freeze({
  0: "clear",
  1: "mainlyClear",
  2: "partlyCloudy",
  3: "overcast",
  45: "fog",
  48: "rimeFog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  56: "freezingDrizzle",
  57: "freezingDrizzle",
  61: "rain",
  63: "rain",
  65: "heavyRain",
  66: "freezingRain",
  67: "freezingRain",
  71: "snow",
  73: "snow",
  75: "heavySnow",
  77: "snowGrains",
  80: "rainShowers",
  81: "rainShowers",
  82: "heavyShowers",
  85: "snowShowers",
  86: "snowShowers",
  95: "thunderstorm",
  96: "thunderstormHail",
  99: "thunderstormHail"
});

export function weatherCodeKey(code) {
  return WEATHER_CODES[Number(code)] ?? "unknown";
}

export function cardinalDirection(degrees) {
  if (!Number.isFinite(Number(degrees))) return "—";
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round(Number(degrees) / 45) % names.length];
}

export async function currentOpenMeteo(config, signal) {
  if (!Number.isFinite(config.latitude) || !Number.isFinite(config.longitude)) {
    throw new Error("Open-Meteo coordinates are not configured");
  }
  const url = new URL(config.openMeteoBaseUrl);
  url.searchParams.set("latitude", String(config.latitude));
  url.searchParams.set("longitude", String(config.longitude));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "surface_pressure",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m"
    ].join(",")
  );
  url.searchParams.set("timezone", config.timezone);
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal
  });
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.current) throw new Error("Open-Meteo returned no current data");
  return payload.current;
}

