import { renderLineChart } from "./modules/chart.js";
import { displayMetricValue, formatNumber, formatTimestamp } from "./modules/format.js";
import { initialLanguage, translator } from "./modules/i18n.js";
import {
  currentMetrics,
  historyMetrics,
  matrixToSeries,
  vectorToReading
} from "./modules/metrics.js";
import { cardinalDirection, currentOpenMeteo, weatherCodeKey } from "./modules/weather.js";

const config = globalThis.WEATHER_CONFIG;
if (!config) throw new Error("WEATHER_CONFIG is missing");

const PERIODS = Object.freeze({
  "24h": { seconds: 24 * 60 * 60, stepSeconds: 300, label: "period24h" },
  "7d": { seconds: 7 * 24 * 60 * 60, stepSeconds: 1800, label: "period7d" },
  "30d": { seconds: 30 * 24 * 60 * 60, stepSeconds: 7200, label: "period30d" },
  "90d": { seconds: 90 * 24 * 60 * 60, stepSeconds: 21600, label: "period90d" },
  "1y": { seconds: 365 * 24 * 60 * 60, stepSeconds: 86400, label: "period1y" }
});

const state = {
  language: initialLanguage(),
  screen: "current",
  period: "24h",
  currentAbort: null,
  historyAbort: null,
  deferredInstall: null
};

const elements = {
  title: document.querySelector("#app-title"),
  stationName: document.querySelector("#station-name"),
  language: document.querySelector("#language-toggle"),
  refresh: document.querySelector("#refresh"),
  refreshLabel: document.querySelector("#refresh-label"),
  currentScreen: document.querySelector("#screen-current"),
  historyScreen: document.querySelector("#screen-history"),
  localStatus: document.querySelector("#local-status"),
  externalStatus: document.querySelector("#external-status"),
  historyStatus: document.querySelector("#history-status"),
  period: document.querySelector("#history-period"),
  historyCharts: document.querySelector("#history-charts"),
  offline: document.querySelector("#offline-banner"),
  installPrompt: document.querySelector("#install-prompt"),
  installTitle: document.querySelector("#install-title"),
  installText: document.querySelector("#install-text"),
  install: document.querySelector("#install"),
  dismissInstall: document.querySelector("#dismiss-install"),
  primaryNavigation: document.querySelector(".bottom-nav")
};

function locale() {
  return state.language === "ru" ? "ru-RU" : "en-GB";
}

function t(key, values) {
  return translator(state.language)(key, values);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function renderLanguage() {
  document.documentElement.lang = state.language;
  document.title = t("appName");
  elements.title.textContent = t("appName");
  elements.stationName.textContent = config.stationName || t("localStation");
  elements.language.textContent = t("language");
  elements.language.setAttribute("aria-label", t("language"));
  elements.refreshLabel.textContent = t("refresh");
  elements.refresh.setAttribute("aria-label", t("refresh"));
  elements.primaryNavigation.setAttribute("aria-label", t("primaryNavigation"));
  setText("#local-title", t("localStation"));
  setText("#external-title", t("dwdStation"));
  setText("#external-source", t("externalSource"));
  setText("#period-label", t("period"));
  setText("#install-title", t("installTitle"));
  setText("#install-text", t("installText"));
  elements.install.textContent = t("install");
  elements.dismissInstall.textContent = t("dismiss");
  elements.offline.textContent = t("offline");

  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const [value, period] of Object.entries(PERIODS)) {
    const option = elements.period.querySelector(`option[value="${value}"]`);
    if (option) option.textContent = t(period.label);
  }
  for (const button of document.querySelectorAll("[data-screen]")) {
    button.setAttribute(
      "aria-label",
      button.dataset.screen === "current" ? t("current") : t("history")
    );
  }
}

function renderScreen() {
  const current = state.screen === "current";
  elements.currentScreen.hidden = !current;
  elements.historyScreen.hidden = current;
  for (const button of document.querySelectorAll("[data-screen]")) {
    const active = button.dataset.screen === state.screen;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  }
  if (!current) loadHistory();
}

function setLoading(active) {
  elements.refresh.disabled = active;
  elements.refresh.classList.toggle("loading", active);
  elements.refreshLabel.textContent = active ? t("refreshing") : t("refresh");
}

function fillLocal(reading) {
  const values = {
    temperature: [reading.temperature, "°C"],
    humidity: [reading.humidity, "%"],
    pressure: [reading.pressure, "hPa"],
    pm25: [reading.pm25, "µg/m³"],
    pm10: [reading.pm10, "µg/m³"]
  };
  for (const [key, [value, unit]] of Object.entries(values)) {
    setText(`#local-${key}`, displayMetricValue(key, value, locale()));
    setText(`#local-${key}-unit`, unit);
  }
  elements.localStatus.textContent = t("updated", {
    time: formatTimestamp(reading.timestamp, locale(), config.timezone)
  });
  elements.localStatus.className = "source-status";
}

function fillExternal(reading) {
  setText("#external-condition", t(`weather.${weatherCodeKey(reading.weather_code)}`));
  setText("#external-temperature", formatNumber(reading.temperature_2m, locale()));
  setText("#external-feels", formatNumber(reading.apparent_temperature, locale()));
  setText("#external-humidity", formatNumber(reading.relative_humidity_2m, locale(), 0));
  setText("#external-pressure", formatNumber(reading.surface_pressure, locale(), 0));
  setText("#external-cloud", formatNumber(reading.cloud_cover, locale(), 0));
  setText("#external-rain", formatNumber(reading.precipitation, locale()));
  setText(
    "#external-wind",
    `${formatNumber(reading.wind_speed_10m, locale(), 0)} ${cardinalDirection(reading.wind_direction_10m)}`
  );
  setText("#external-gusts", formatNumber(reading.wind_gusts_10m, locale(), 0));
  elements.externalStatus.textContent = t("updated", {
    time: new Intl.DateTimeFormat(locale(), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: config.timezone
    }).format(new Date(reading.time))
  });
  elements.externalStatus.className = "source-status";
}

async function loadCurrent() {
  state.currentAbort?.abort();
  state.currentAbort = new AbortController();
  setLoading(true);
  const signal = state.currentAbort.signal;
  const [local, external] = await Promise.allSettled([
    currentMetrics(config.metricsBaseUrl, signal),
    currentOpenMeteo(config, signal)
  ]);
  if (signal.aborted) return;

  if (local.status === "fulfilled") {
    const reading = vectorToReading(local.value);
    if (reading.timestamp) fillLocal(reading);
    else {
      elements.localStatus.textContent = t("localUnavailable");
      elements.localStatus.className = "source-status error";
    }
  } else {
    elements.localStatus.textContent = t("localUnavailable");
    elements.localStatus.className = "source-status error";
  }

  if (external.status === "fulfilled") fillExternal(external.value);
  else {
    elements.externalStatus.textContent = t("externalUnavailable");
    elements.externalStatus.className = "source-status error";
  }
  setLoading(false);
}

function chartOptions(key) {
  const labels = {
    temperature: ["temperature", "°C"],
    humidity: ["humidity", "%"],
    pressure: ["pressure", "hPa"],
    pm25: ["pm25", "µg/m³"],
    pm10: ["pm10", "µg/m³"]
  };
  const [labelKey, unit] = labels[key];
  return {
    ariaLabel: t("chartFor", { metric: t(labelKey) }),
    emptyLabel: t("noHistory"),
    transform: key === "pressure" ? (value) => value / 100 : undefined,
    formatValue: (value) => `${formatNumber(value, locale(), 0)} ${unit}`,
    formatTime: (timestamp) =>
      new Intl.DateTimeFormat(locale(), {
        day: "2-digit",
        month: "short",
        hour: state.period === "24h" ? "2-digit" : undefined,
        minute: state.period === "24h" ? "2-digit" : undefined,
        timeZone: config.timezone
      }).format(new Date(timestamp * 1000))
  };
}

function renderHistory(series) {
  elements.historyCharts.replaceChildren();
  for (const key of ["temperature", "humidity", "pressure", "pm25", "pm10"]) {
    const card = document.createElement("article");
    card.className = "chart-card";
    const heading = document.createElement("h2");
    heading.textContent = t(key);
    const chart = document.createElement("div");
    chart.className = "chart-wrap";
    card.append(heading, chart);
    elements.historyCharts.append(card);
    renderLineChart(chart, series[key] ?? [], chartOptions(key));
  }
}

async function loadHistory() {
  state.historyAbort?.abort();
  state.historyAbort = new AbortController();
  elements.historyStatus.textContent = t("refreshing");
  elements.historyStatus.className = "source-status";
  try {
    const data = await historyMetrics(
      config.metricsBaseUrl,
      PERIODS[state.period],
      state.historyAbort.signal
    );
    renderHistory(matrixToSeries(data));
    elements.historyStatus.textContent = t("updated", {
      time: new Intl.DateTimeFormat(locale(), {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: config.timezone
      }).format(new Date())
    });
  } catch (error) {
    if (error.name === "AbortError") return;
    elements.historyStatus.textContent = t("historyUnavailable");
    elements.historyStatus.className = "source-status error";
  }
}

elements.language.addEventListener("click", () => {
  state.language = state.language === "en" ? "ru" : "en";
  localStorage.setItem("weather-language", state.language);
  renderLanguage();
  loadCurrent();
  if (state.screen === "history") loadHistory();
});
elements.refresh.addEventListener("click", loadCurrent);
elements.period.addEventListener("change", () => {
  state.period = elements.period.value;
  loadHistory();
});
for (const button of document.querySelectorAll("[data-screen]")) {
  button.addEventListener("click", () => {
    state.screen = button.dataset.screen;
    renderScreen();
  });
}

window.addEventListener("online", () => {
  elements.offline.hidden = true;
  loadCurrent();
});
window.addEventListener("offline", () => {
  elements.offline.hidden = false;
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredInstall = event;
  elements.installPrompt.hidden = false;
});
elements.install.addEventListener("click", async () => {
  if (!state.deferredInstall) return;
  await state.deferredInstall.prompt();
  state.deferredInstall = null;
  elements.installPrompt.hidden = true;
});
elements.dismissInstall.addEventListener("click", () => {
  elements.installPrompt.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

elements.offline.hidden = navigator.onLine;
renderLanguage();
renderScreen();
loadCurrent();
setInterval(loadCurrent, 150_000);
