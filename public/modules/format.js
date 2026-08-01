export function formatNumber(value, locale, maximumFractionDigits = 1) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

export function formatTimestamp(timestamp, locale, timezone) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    timeZone: timezone
  }).format(new Date(timestamp * 1000));
}

export function displayMetricValue(key, value, locale) {
  if (key === "pressure") return formatNumber(value / 100, locale, 0);
  return formatNumber(value, locale, key.startsWith("pm") ? 0 : 1);
}

