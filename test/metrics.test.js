import { describe, expect, test } from "bun:test";
import { matrixToSeries, normalizeMetricsBaseUrl, vectorToReading } from "../public/modules/metrics.js";

describe("VictoriaMetrics response mapping", () => {
  test("maps current sensor metrics without losing the newest timestamp", () => {
    const reading = vectorToReading({
      result: [
        { metric: { __name__: "weather_BME280_temperature" }, value: [100, "18.5"] },
        { metric: { __name__: "weather_BME280_humidity" }, value: [101, "72"] },
        { metric: { __name__: "weather_SDS_P2" }, value: [99, "4.1"] }
      ]
    });
    expect(reading).toEqual({ temperature: 18.5, humidity: 72, pm25: 4.1, timestamp: 101 });
  });

  test("maps matrix data and drops non-numeric samples", () => {
    expect(
      matrixToSeries({
        result: [
          {
            metric: { __name__: "weather_SDS_P1" },
            values: [[1, "10"], [2, "bad"], [3, "12"]]
          }
        ]
      })
    ).toEqual({ pm10: [{ timestamp: 1, value: 10 }, { timestamp: 3, value: 12 }] });
  });

  test("requires an HTTPS metrics origin", () => {
    expect(normalizeMetricsBaseUrl("https://metrics.home.reutov.me/")).toBe(
      "https://metrics.home.reutov.me"
    );
    expect(() => normalizeMetricsBaseUrl("http://metrics.home.reutov.me")).toThrow();
  });
});

