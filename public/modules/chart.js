const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

export function renderLineChart(container, points, options) {
  container.replaceChildren();
  if (!points?.length) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = options.emptyLabel;
    container.append(empty);
    return;
  }

  const normalized = points
    .map(({ timestamp, value }) => ({
      timestamp,
      value: options.transform ? options.transform(value) : value
    }))
    .filter(({ value }) => Number.isFinite(value));
  if (!normalized.length) return;

  const width = 640;
  const height = 210;
  const padding = { top: 20, right: 18, bottom: 32, left: 52 };
  const values = normalized.map(({ value }) => value);
  const times = normalized.map(({ timestamp }) => timestamp);
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  const spread = maximum - minimum || Math.max(Math.abs(maximum) * 0.08, 1);
  minimum -= spread * 0.12;
  maximum += spread * 0.12;
  const first = Math.min(...times);
  const last = Math.max(...times);
  const duration = last - first || 1;
  const x = (timestamp) =>
    padding.left + ((timestamp - first) / duration) * (width - padding.left - padding.right);
  const y = (value) =>
    padding.top +
    ((maximum - value) / (maximum - minimum)) *
      (height - padding.top - padding.bottom);

  const svg = svgElement("svg", {
    class: "history-chart",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": options.ariaLabel
  });

  for (let index = 0; index < 4; index += 1) {
    const ratio = index / 3;
    const value = maximum - ratio * (maximum - minimum);
    const lineY = y(value);
    svg.append(
      svgElement("line", {
        x1: padding.left,
        x2: width - padding.right,
        y1: lineY,
        y2: lineY,
        class: "chart-grid"
      })
    );
    const label = svgElement("text", {
      x: padding.left - 10,
      y: lineY + 4,
      class: "chart-label",
      "text-anchor": "end"
    });
    label.textContent = options.formatValue(value);
    svg.append(label);
  }

  const path = normalized
    .map(({ timestamp, value }, index) =>
      `${index === 0 ? "M" : "L"}${x(timestamp).toFixed(2)},${y(value).toFixed(2)}`
    )
    .join(" ");
  svg.append(svgElement("path", { d: path, class: "chart-line" }));

  const startLabel = svgElement("text", {
    x: padding.left,
    y: height - 8,
    class: "chart-label",
    "text-anchor": "start"
  });
  startLabel.textContent = options.formatTime(first);
  const endLabel = svgElement("text", {
    x: width - padding.right,
    y: height - 8,
    class: "chart-label",
    "text-anchor": "end"
  });
  endLabel.textContent = options.formatTime(last);
  svg.append(startLabel, endLabel);
  container.append(svg);
}

