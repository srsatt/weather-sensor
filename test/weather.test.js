import { describe, expect, test } from "bun:test";
import { cardinalDirection, weatherCodeKey } from "../public/modules/weather.js";

describe("weather presentation", () => {
  test("uses explicit WMO code groups", () => {
    expect(weatherCodeKey(61)).toBe("rain");
    expect(weatherCodeKey(71)).toBe("snow");
    expect(weatherCodeKey(80)).toBe("rainShowers");
    expect(weatherCodeKey(999)).toBe("unknown");
  });

  test("formats compass sectors", () => {
    expect(cardinalDirection(0)).toBe("N");
    expect(cardinalDirection(92)).toBe("E");
    expect(cardinalDirection(225)).toBe("SW");
  });
});

