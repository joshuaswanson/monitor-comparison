import { chartArea, SVG_NS } from "./dom.js";
import { xPos, yPos, measureChart } from "./scale.js";
import { state, labelEls, labelWidths } from "./state.js";
import { setThemedColor } from "./util.js";

let refSvg = null;

const CURVE_SAMPLES = 200;

function axesAre(a, b) {
  return (
    (state.xAxisKey === a && state.yAxisKey === b) ||
    (state.xAxisKey === b && state.yAxisKey === a)
  );
}

const STRAIGHT_STYLE = {
  labelClass: "ratio-label",
  labelOpacity: "0.5",
  strokeOpacity: "0.25",
  dash: "6 4",
};

const CURVED_STYLE = {
  labelClass: "curve-label",
  labelOpacity: "0.4",
  strokeOpacity: "0.2",
  dash: "3 3",
};

// Each geometry() returns how one reference entry is drawn on the current
// axes, in data units, or null when it has no meaning on them.
//   { ray: slope }           y = slope * x
//   { vertical: x }
//   { horizontal: y }
//   { curve: fn, labelAtEnd } y = fn(x)
export const REF_KINDS = [
  {
    id: "ratio",
    heading: "Aspect Ratio",
    source: "ratioLines",
    strokeWidth: "1.5",
    ...STRAIGHT_STYLE,
    geometry(d) {
      if (axesAre("w", "h") || axesAre("wIn", "hIn")) {
        const xIsWidth = state.xAxisKey === "w" || state.xAxisKey === "wIn";
        return { ray: xIsWidth ? 1 / d.r : d.r };
      }
      if (state.xAxisKey === "ar") return { vertical: d.r };
      if (state.yAxisKey === "ar") return { horizontal: d.r };
      return null;
    },
  },
  {
    id: "mp",
    heading: "Megapixels",
    source: "mpCurves",
    strokeWidth: "1.2",
    ...CURVED_STYLE,
    geometry(d) {
      const totalPx = d.w * d.h;
      if (axesAre("w", "h")) return { curve: (x) => totalPx / x };
      if (state.xAxisKey === "area" && state.yAxisKey === "ppi") {
        return { curve: (area) => Math.sqrt(totalPx / area), labelAtEnd: true };
      }
      if (state.xAxisKey === "ppi" && state.yAxisKey === "area") {
        return { curve: (ppi) => totalPx / (ppi * ppi), labelAtEnd: true };
      }
      return null;
    },
  },
  {
    id: "area",
    heading: "Screen Area",
    source: "areaCurves",
    strokeWidth: "1.2",
    ...CURVED_STYLE,
    geometry(d) {
      return axesAre("wIn", "hIn") ? { curve: (x) => d.area / x } : null;
    },
  },
  {
    id: "ppi",
    heading: "PPI",
    source: "ppiLines",
    strokeWidth: "1",
    ...STRAIGHT_STYLE,
    geometry(d) {
      // MP = area * PPI² / 1e6
      if (state.xAxisKey === "area" && state.yAxisKey === "mp") {
        return { ray: (d.ppi * d.ppi) / 1e6 };
      }
      if (state.xAxisKey === "mp" && state.yAxisKey === "area") {
        return { ray: 1e6 / (d.ppi * d.ppi) };
      }
      return null;
    },
  },
];

export function createRefLines() {
  refSvg = document.createElementNS(SVG_NS, "svg");
  refSvg.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;";
  chartArea.appendChild(refSvg);

  state.refLines.forEach((ref) => {
    const path = document.createElementNS(SVG_NS, "path");
    setThemedColor(path, ref.data);
    path.style.stroke = "var(--c)";
    path.setAttribute("stroke-opacity", ref.kind.strokeOpacity);
    path.setAttribute("stroke-width", ref.kind.strokeWidth);
    path.setAttribute("stroke-dasharray", ref.kind.dash);
    path.setAttribute("fill", "none");
    refSvg.appendChild(path);

    const label = document.createElement("div");
    label.className = ref.kind.labelClass;
    setThemedColor(label, ref.data);
    label.style.color = "var(--c)";
    label.style.opacity = ref.kind.labelOpacity;
    label.textContent = ref.data.name;
    chartArea.appendChild(label);

    ref.path = path;
    ref.label = label;
  });
}

function drawRay(slope, path) {
  const x1 = Math.max(state.xRange.min, state.yRange.min / slope);
  const x2 = Math.min(state.xRange.max, state.yRange.max / slope);
  if (x1 >= x2) return null;
  const sx2 = xPos(x2);
  const sy2 = yPos(slope * x2);
  path.setAttribute("d", `M ${xPos(x1)} ${yPos(slope * x1)} L ${sx2} ${sy2}`);
  return { left: sx2 + 6, top: sy2 - 18 };
}

function drawVertical(x, path) {
  const sx = xPos(x);
  if (sx < 0 || sx > state.chartWidth) return null;
  path.setAttribute("d", `M ${sx} 0 L ${sx} ${state.chartHeight}`);
  return { left: sx + 6, top: 2 };
}

function drawHorizontal(y, path) {
  const sy = yPos(y);
  if (sy < 0 || sy > state.chartHeight) return null;
  path.setAttribute("d", `M 0 ${sy} L ${state.chartWidth} ${sy}`);
  return { left: state.chartWidth + 6, top: sy - 6 };
}

function drawCurve(fn, labelAtEnd, path) {
  let d = "";
  let firstVisible = null;
  let lastVisible = null;
  for (let j = 0; j <= CURVE_SAMPLES; j++) {
    const t = j / CURVE_SAMPLES;
    const px = state.xRange.min + t * (state.xRange.max - state.xRange.min);
    const py = fn(px);
    if (!isFinite(py)) continue;
    const sx = xPos(px);
    const sy = yPos(py);
    const inBounds =
      sy >= 0 && sy <= state.chartHeight && sx >= 0 && sx <= state.chartWidth;
    if (inBounds) {
      d += (d ? " L " : "M ") + sx.toFixed(1) + " " + sy.toFixed(1);
      if (!firstVisible) firstVisible = { sx, sy };
      lastVisible = { sx, sy };
    } else if (d) {
      const csx = Math.max(0, Math.min(state.chartWidth, sx));
      const csy = Math.max(0, Math.min(state.chartHeight, sy));
      d += " L " + csx.toFixed(1) + " " + csy.toFixed(1);
      break;
    }
  }
  const anchor = labelAtEnd ? lastVisible : firstVisible;
  if (!anchor) return null;
  path.setAttribute("d", d);
  return { left: anchor.sx + 6, top: anchor.sy - 6 };
}

function drawRefLine(ref) {
  const g = ref.enabled ? ref.kind.geometry(ref.data) : null;
  if (!g) return null;
  if ("ray" in g) return drawRay(g.ray, ref.path);
  if ("vertical" in g) return drawVertical(g.vertical, ref.path);
  if ("horizontal" in g) return drawHorizontal(g.horizontal, ref.path);
  return drawCurve(g.curve, g.labelAtEnd, ref.path);
}

function spreadRefLabels(placed) {
  placed.sort((a, b) => a.top - b.top);
  const minGap = 14;
  for (let i = 1; i < placed.length; i++) {
    const prev = placed[i - 1];
    const curr = placed[i];
    if (Math.abs(curr.left - prev.left) < 60 && curr.top - prev.top < minGap) {
      curr.top = prev.top + minGap;
    }
  }
}

export function updateRefLines() {
  const placed = [];
  state.refLines.forEach((ref) => {
    const anchor = drawRefLine(ref);
    if (!anchor) {
      ref.path.setAttribute("d", "");
      ref.label.style.display = "none";
      return;
    }
    placed.push({ label: ref.label, ...anchor });
  });

  spreadRefLabels(placed);

  placed.forEach(({ label, left, top }) => {
    const overflowsIntoXAxis = top > state.chartHeight - 4;
    label.style.display = overflowsIntoXAxis ? "none" : "";
    label.style.left = left + "px";
    label.style.top = top + "px";
  });
}

export function updateLabelMargin() {
  const anyDrawn = state.refLines.some(
    (ref) => ref.enabled && ref.kind.geometry(ref.data),
  );
  const widest = Math.max(0, ...state.refLines.map((ref) => ref.labelWidth));
  chartArea.style.right = (anyDrawn ? widest + 14 : 20) + "px";
  measureChart();
}

function measureWhileDisplayed(els, record) {
  const previous = els.map((el) => el.style.display);
  els.forEach((el) => (el.style.display = ""));
  els.forEach((el, i) => record(i, el.offsetWidth));
  els.forEach((el, i) => (el.style.display = previous[i]));
}

export function measureLabelWidths() {
  measureWhileDisplayed(labelEls, (i, width) => (labelWidths[i] = width));
  measureWhileDisplayed(
    state.refLines.map((ref) => ref.label),
    (i, width) => (state.refLines[i].labelWidth = width),
  );
}
