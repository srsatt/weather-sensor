# Weather Sensor

A small, dependency-free progressive web app for a local Sensor.Community
weather station. It has two views:

- current local readings alongside DWD ICON conditions from Open-Meteo;
- VictoriaMetrics history with selectable time periods.

The UI is responsive, installable, and available in English and Russian. It
runs entirely as static files and talks directly to a narrowly exposed,
read-only VictoriaMetrics query gateway.

## Runtime configuration

`public/config.js` is intentionally not committed. The deployment creates it
from host-local configuration:

```js
globalThis.WEATHER_CONFIG = Object.freeze({
  metricsBaseUrl: "https://metrics.home.reutov.me",
  openMeteoBaseUrl: "https://api.open-meteo.com/v1/dwd-icon",
  latitude: 0,
  longitude: 0,
  timezone: "Europe/Berlin",
  stationName: "Home"
});
```

For local development:

```bash
cp public/config.example.js public/config.js
bun run serve
```

Then open <http://localhost:4173>. The example coordinates are deliberately
invalid, so live Open-Meteo data stays disabled until you provide local values.

## Validation

```bash
bun run check
```

The production artifact is the contents of `public/`. Releases are packaged as
`weather-sensor-vX.Y.Z.tar.gz`; the homelab fleet pins both the release URL and
SHA-256 before installation.

## Security boundary

The browser can only use the gateway's current and range query endpoints. The
gateway injects `extra_label=db=weather`, so a client cannot query unrelated
VictoriaMetrics series. Ingestion and VMUI use separate Caddy routes and are
not available to the app.

