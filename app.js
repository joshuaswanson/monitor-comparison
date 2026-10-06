let monitors = [];
let categories = {};
let refLines = [];
let groups = {};

const dotEls = [];
const labelEls = [];
const labelWidths = [];
let badgeEls = {};

let visibleMonitors = new Set();
let plotted = new Set();
let pricesChecked = null;

let xRange, yRange, W, H, areaOffsetTop, areaOffsetLeft;

const DEFAULT_X_AXIS = "area";
const DEFAULT_Y_AXIS = "ppi";
let xAxisKey = DEFAULT_X_AXIS,
  yAxisKey = DEFAULT_Y_AXIS;

const AXES = {
  w: { label: "Horizontal Pixels", format: (v) => v.toFixed(0) },
  h: { label: "Vertical Pixels", format: (v) => v.toFixed(0) },
  ppi: { label: "PPI", format: (v) => v.toFixed(0) },
  ar: { label: "Aspect Ratio", format: (v) => v.toFixed(2) },
  diag: { label: "Diagonal (in)", format: (v) => v.toFixed(1) },
  mp: { label: "Megapixels", format: (v) => v.toFixed(1) },
  area: { label: "Screen Area (in²)", format: (v) => v.toFixed(0) },
  wIn: { label: "Width (in)", format: (v) => v.toFixed(1) },
  hIn: { label: "Height (in)", format: (v) => v.toFixed(1) },
  hz: { label: "Refresh Rate (Hz)", format: (v) => v.toFixed(0) },
  price: { label: "Street Price (USD)", format: (v) => "$" + v.toFixed(0) },
};

const AXIS_GROUPS = [
  { label: "Physical Size", keys: ["wIn", "hIn", "diag", "area"] },
  { label: "Resolution", keys: ["w", "h", "mp"] },
  { label: "Price", keys: ["price"] },
  { label: "Other", keys: ["ppi", "ar", "hz"] },
];

const chartArea = document.getElementById("chartArea");
const chartContainer = document.getElementById("chart");
const chartNote = document.getElementById("chartNote");
const yLabelsCol = document.getElementById("yLabelsCol");
const tooltip = document.getElementById("tooltip");
const ttName = document.getElementById("ttName");
const ttDetail = document.getElementById("ttDetail");
const legendContainer = document.getElementById("legend");

const SVG_NS = "http://www.w3.org/2000/svg";
let refSvg = null;
let gridLayer = null;

const CURVE_SAMPLES = 200;

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function xPos(v) {
  return ((v - xRange.min) / (xRange.max - xRange.min)) * W;
}
function yPos(v) {
  return H - ((v - yRange.min) / (yRange.max - yRange.min)) * H;
}

function niceRange(values, padding) {
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const rng = mx - mn || 1;
  return { min: Math.max(0, mn - rng * padding), max: mx + rng * padding };
}

function niceTicks(min, max, count) {
  const rough = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].find((c) => c * mag >= rough) * mag;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    ticks.push(parseFloat(v.toPrecision(10)));
  }
  return ticks;
}

function measureChart() {
  const rect = chartArea.getBoundingClientRect();
  W = rect.width;
  H = rect.height;
  const chartRect = chartContainer.getBoundingClientRect();
  areaOffsetLeft = rect.left - chartRect.left - chartContainer.clientLeft;
  areaOffsetTop = rect.top - chartRect.top;
}

function axisRange(key) {
  let values = [...plotted].map((i) => monitors[i][key]);
  if (values.length === 0) {
    values = monitors.map((m) => m[key]).filter(Number.isFinite);
  }
  if (values.length === 0) return { min: 0, max: 1 };
  return niceRange(values, 0.15);
}

function targetRanges() {
  return { x: axisRange(xAxisKey), y: axisRange(yAxisKey) };
}

function refreshPlotted() {
  plotted = new Set(
    [...visibleMonitors].filter(
      (i) =>
        Number.isFinite(monitors[i][xAxisKey]) &&
        Number.isFinite(monitors[i][yAxisKey]),
    ),
  );
  const notes = [];
  if (xAxisKey === "price" || yAxisKey === "price") {
    notes.push(`Street prices checked on ${pricesChecked}.`);
  }
  const missing = visibleMonitors.size - plotted.size;
  if (missing > 0) {
    notes.push(
      `${missing} selected ${missing === 1 ? "monitor has" : "monitors have"} no value for these axes and ${missing === 1 ? "is" : "are"} left off the chart.`,
    );
  }
  chartNote.textContent = notes.join(" ");
}

function applyPlottedDisplay() {
  monitors.forEach((_, i) => {
    const show = plotted.has(i);
    dotEls[i].style.display = show ? "" : "none";
    labelEls[i].style.display = show ? "" : "none";
  });
}

function fanOffsets(n) {
  const radius = 18;
  const startAngle = -Math.PI / 2;
  const offsets = [];
  for (let i = 0; i < n; i++) {
    const angle = startAngle + ((2 * Math.PI) / n) * i;
    offsets.push({
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
    });
  }
  return offsets;
}

function groupCentroid(indices) {
  const cx =
    indices.reduce((s, i) => s + xPos(monitors[i][xAxisKey]), 0) /
    indices.length;
  const cy =
    indices.reduce((s, i) => s + yPos(monitors[i][yAxisKey]), 0) /
    indices.length;
  return { cx, cy };
}

const LABEL_HEIGHT = 12;
const DOT_OBSTACLE_RADIUS = 8;
const EXPANDED_DOT_PAD = 12;

const LABEL_CANDIDATES = [
  (cx, cy) => ({ lx: cx + 12, ly: cy - 4, alignRight: false }),
  (cx, cy) => ({ lx: cx + 12, ly: cy - 14, alignRight: false }),
  (cx, cy) => ({ lx: cx + 12, ly: cy + 10, alignRight: false }),
  (cx, cy) => ({ lx: cx - 12, ly: cy - 4, alignRight: true }),
  (cx, cy) => ({ lx: cx - 12, ly: cy - 14, alignRight: true }),
  (cx, cy) => ({ lx: cx - 12, ly: cy + 10, alignRight: true }),
];

function defaultLabelSpot(cx, cy) {
  const alignRight = cx > W * 0.85;
  return {
    lx: alignRight ? cx - 12 : cx + 12,
    ly: cy < H * 0.1 ? cy + 10 : cy - 4,
    alignRight,
  };
}

function labelRect(lx, ly, lw, alignRight) {
  const left = alignRight ? lx - lw : lx;
  return { left, right: left + lw, top: ly, bottom: ly + LABEL_HEIGHT };
}

function rectsOverlap(a, b) {
  return (
    a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
  );
}

function rectAround(x, y, halfW, halfH) {
  return { left: x - halfW, right: x + halfW, top: y - halfH, bottom: y + halfH };
}

function placeSingleton(i, cx, cy, layout) {
  dotEls[i].style.left = cx + "px";
  dotEls[i].style.top = cy + "px";
  labelEls[i].style.opacity = "1";
  layout.singletonLabels.push({
    idx: i,
    cx,
    cy,
    ...defaultLabelSpot(cx, cy),
  });
}

function placeExpandedGroup(key, group, cx, cy, layout) {
  const offsets = fanOffsets(group.indices.length);
  const maxDx = Math.max(...offsets.map((o) => o.dx));
  const minDx = Math.min(...offsets.map((o) => o.dx));

  group.indices.forEach((mi, j) => {
    const { dx, dy } = offsets[j];
    const x = cx + dx;
    const y = cy + dy;
    dotEls[mi].style.left = x + "px";
    dotEls[mi].style.top = y + "px";
    dotEls[mi].style.zIndex = "5";
    dotEls[mi].style.opacity = "";
    labelEls[mi].style.opacity = "1";
    labelEls[mi].style.zIndex = "6";

    const onLeft = dx < -3;
    const isRightmost = dx === maxDx && dx > 3;
    const isLeftmost = dx === minDx && onLeft;
    const lx = onLeft ? x - 10 : x + 10;
    let ly = y - 4;
    if (!isRightmost && !isLeftmost) {
      if (dy > 3) ly = y + 8;
      else if (dy < -3) ly = y - 12;
    }
    labelEls[mi].style.transform = onLeft ? "translateX(-100%)" : "";
    labelEls[mi].style.left = lx + "px";
    labelEls[mi].style.top = ly + "px";

    const labelLeft = onLeft ? lx - labelWidths[mi] : lx;
    layout.expandedObstacles.push({
      x,
      y,
      labelLeft,
      labelRight: labelLeft + labelWidths[mi],
      labelTop: ly,
      labelBottom: ly + 14,
    });
  });

  layout.expandedObstacles.push({
    x: cx,
    y: cy,
    labelLeft: cx - 10,
    labelRight: cx + 10,
    labelTop: cy - 10,
    labelBottom: cy + 10,
  });

  badgeEls[key].style.left = cx + "px";
  badgeEls[key].style.top = cy + "px";
  badgeEls[key].style.opacity = "0.4";
  badgeEls[key].style.pointerEvents = "";
}

function placeCollapsedGroup(key, group, cx, cy, layout) {
  group.indices.forEach((mi) => {
    dotEls[mi].style.left = cx + "px";
    dotEls[mi].style.top = cy + "px";
    dotEls[mi].style.zIndex = "";
    labelEls[mi].style.left = cx + "px";
    labelEls[mi].style.top = cy + "px";
    labelEls[mi].style.opacity = "0";
    labelEls[mi].style.zIndex = "";
  });
  badgeEls[key].style.left = cx + "px";
  badgeEls[key].style.top = cy + "px";
  layout.collapsedBadges.push({ key, group, x: cx, y: cy });
}

function coveredByExpandedCluster(px, py, expandedObstacles) {
  const pad = EXPANDED_DOT_PAD;
  return expandedObstacles.some(
    (ep) =>
      (Math.abs(px - ep.x) < pad * 2 && Math.abs(py - ep.y) < pad * 2) ||
      (px + pad > ep.labelLeft - 4 &&
        px - pad < ep.labelRight + 4 &&
        py + pad > ep.labelTop - 2 &&
        py - pad < ep.labelBottom + 2),
  );
}

function hideItemsCoveredByExpandedClusters(layout) {
  layout.collapsedBadges.forEach((badge) => {
    badge.hidden = coveredByExpandedCluster(
      badge.x,
      badge.y,
      layout.expandedObstacles,
    );
    const el = badgeEls[badge.key];
    el.style.opacity = badge.hidden ? "0" : "1";
    el.style.pointerEvents = badge.hidden ? "none" : "";
    badge.group.indices.forEach((mi) => {
      dotEls[mi].style.opacity = badge.hidden ? "0" : "";
    });
  });

  layout.singletonLabels.forEach((sl) => {
    sl.hidden = coveredByExpandedCluster(sl.cx, sl.cy, layout.expandedObstacles);
    dotEls[sl.idx].style.opacity = sl.hidden ? "0" : "";
    labelEls[sl.idx].style.opacity = sl.hidden ? "0" : "1";
  });
}

function labelObstacles(layout) {
  const hiddenSingletons = new Set(
    layout.singletonLabels.filter((sl) => sl.hidden).map((sl) => sl.idx),
  );
  const dots = [...plotted]
    .filter((i) => !hiddenSingletons.has(i))
    .map((i) => ({
      idx: i,
      rect: rectAround(
        parseFloat(dotEls[i].style.left),
        parseFloat(dotEls[i].style.top),
        DOT_OBSTACLE_RADIUS,
        DOT_OBSTACLE_RADIUS,
      ),
    }));
  const badges = layout.collapsedBadges
    .filter((badge) => !badge.hidden)
    .map((badge) =>
      rectAround(
        badge.x,
        badge.y,
        badge.group.badgeSize.width / 2 + 2,
        badge.group.badgeSize.height / 2 + 2,
      ),
    );
  return { dots, badges };
}

function placeSingletonLabels(layout) {
  const { dots, badges } = labelObstacles(layout);
  const placedLabels = [];

  function isFree(rect, ownIdx) {
    return (
      !dots.some((d) => d.idx !== ownIdx && rectsOverlap(rect, d.rect)) &&
      !badges.some((b) => rectsOverlap(rect, b)) &&
      !placedLabels.some((pl) => rectsOverlap(rect, pl))
    );
  }

  layout.singletonLabels.forEach((sl) => {
    if (sl.hidden) return;
    const el = labelEls[sl.idx];
    const lw = labelWidths[sl.idx];
    const spots = [sl, ...LABEL_CANDIDATES.map((fn) => fn(sl.cx, sl.cy))];
    const spot = spots.find((s) =>
      isFree(labelRect(s.lx, s.ly, lw, s.alignRight), sl.idx),
    );
    if (!spot) {
      el.style.opacity = "0";
      return;
    }
    placedLabels.push(labelRect(spot.lx, spot.ly, lw, spot.alignRight));
    el.style.transform = spot.alignRight ? "translateX(-100%)" : "";
    el.style.left = spot.lx + "px";
    el.style.top = spot.ly + "px";
  });
}

function positionDots() {
  const layout = {
    singletonLabels: [],
    expandedObstacles: [],
    collapsedBadges: [],
  };

  Object.entries(groups).forEach(([key, group]) => {
    const { cx, cy } = groupCentroid(group.indices);
    if (group.indices.length === 1) {
      placeSingleton(group.indices[0], cx, cy, layout);
    } else if (group.expanded) {
      placeExpandedGroup(key, group, cx, cy, layout);
    } else {
      placeCollapsedGroup(key, group, cx, cy, layout);
    }
  });

  hideItemsCoveredByExpandedClusters(layout);
  placeSingletonLabels(layout);
}

function legendGroups() {
  const catsByGroup = new Map();
  Object.entries(categories).forEach(([key, cat]) => {
    if (!catsByGroup.has(cat.group)) catsByGroup.set(cat.group, []);
    catsByGroup.get(cat.group).push(key);
  });
  return [...catsByGroup].map(([label, cats]) => ({ label, cats }));
}

function sortedCategories() {
  const grouped = {};
  monitors.forEach((m, i) => {
    if (!grouped[m.cat]) grouped[m.cat] = { indices: [] };
    grouped[m.cat].indices.push(i);
  });
  return Object.keys(categories)
    .filter((key) => grouped[key])
    .map((key) => ({
      key,
      indices: grouped[key].indices,
    }));
}

function setThemedColor(el, entry) {
  el.classList.add("themed");
  el.style.setProperty("--color-dark", entry.color);
  el.style.setProperty("--color-light", entry.colorLight);
}

function categorySwatch(className, cat) {
  const swatch = document.createElement("div");
  swatch.className = className + (cat.shape === "diamond" ? " diamond" : "");
  setThemedColor(swatch, cat);
  swatch.style.background = "var(--c)";
  return swatch;
}

function buildLegend() {
  legendContainer.innerHTML = "";
  const present = new Set(monitors.map((m) => m.cat));
  legendGroups().forEach((group) => {
    const cats = group.cats.filter((c) => present.has(c));
    if (cats.length === 0) return;
    const section = document.createElement("div");
    section.className = "legend-group";
    const heading = document.createElement("div");
    heading.className = "legend-group-heading";
    heading.textContent = group.label;
    section.appendChild(heading);
    cats.forEach((key) => {
      const cat = categories[key];
      const item = document.createElement("div");
      item.className = "legend-item";
      item.appendChild(categorySwatch("legend-dot", cat));
      item.appendChild(document.createTextNode(cat.label));
      section.appendChild(item);
    });
    legendContainer.appendChild(section);
  });
}

function drawGrid() {
  if (gridLayer) gridLayer.remove();
  gridLayer = document.createElement("div");
  gridLayer.style.cssText =
    "position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;";
  chartArea.insertBefore(gridLayer, chartArea.firstChild);

  yLabelsCol.innerHTML = "";
  chartContainer.querySelectorAll(".axis-label-x").forEach((el) => el.remove());

  const yFmt = AXES[yAxisKey].format;
  const xFmt = AXES[xAxisKey].format;

  niceTicks(yRange.min, yRange.max, 7).forEach((v) => {
    const y = yPos(v);
    if (y < -5 || y > H + 5) return;
    const line = document.createElement("div");
    line.className = "grid-line-h";
    line.style.top = y + "px";
    gridLayer.appendChild(line);
    const lbl = document.createElement("div");
    lbl.className = "axis-label-y";
    lbl.style.top = areaOffsetTop + y + "px";
    lbl.textContent = yFmt(v);
    yLabelsCol.appendChild(lbl);
  });

  niceTicks(xRange.min, xRange.max, 8).forEach((v) => {
    const x = xPos(v);
    if (x < -5 || x > W + 5) return;
    const line = document.createElement("div");
    line.className = "grid-line-v";
    line.style.left = x + "px";
    gridLayer.appendChild(line);
    const lbl = document.createElement("div");
    lbl.className = "axis-label-x";
    lbl.style.left = areaOffsetLeft + x + "px";
    lbl.textContent = xFmt(v);
    chartContainer.appendChild(lbl);
  });
}

function axesAre(a, b) {
  return (
    (xAxisKey === a && yAxisKey === b) || (xAxisKey === b && yAxisKey === a)
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
const REF_KINDS = [
  {
    id: "ratio",
    heading: "Aspect Ratio",
    source: "ratioLines",
    strokeWidth: "1.5",
    ...STRAIGHT_STYLE,
    geometry(d) {
      if (axesAre("w", "h") || axesAre("wIn", "hIn")) {
        const xIsWidth = xAxisKey === "w" || xAxisKey === "wIn";
        return { ray: xIsWidth ? 1 / d.r : d.r };
      }
      if (xAxisKey === "ar") return { vertical: d.r };
      if (yAxisKey === "ar") return { horizontal: d.r };
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
      if (xAxisKey === "area" && yAxisKey === "ppi") {
        return { curve: (area) => Math.sqrt(totalPx / area), labelAtEnd: true };
      }
      if (xAxisKey === "ppi" && yAxisKey === "area") {
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
      if (xAxisKey === "area" && yAxisKey === "mp") {
        return { ray: (d.ppi * d.ppi) / 1e6 };
      }
      if (xAxisKey === "mp" && yAxisKey === "area") {
        return { ray: 1e6 / (d.ppi * d.ppi) };
      }
      return null;
    },
  },
];

function createRefLines() {
  refSvg = document.createElementNS(SVG_NS, "svg");
  refSvg.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;";
  chartArea.appendChild(refSvg);

  refLines.forEach((ref) => {
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
  const x1 = Math.max(xRange.min, yRange.min / slope);
  const x2 = Math.min(xRange.max, yRange.max / slope);
  if (x1 >= x2) return null;
  const sx2 = xPos(x2);
  const sy2 = yPos(slope * x2);
  path.setAttribute(
    "d",
    `M ${xPos(x1)} ${yPos(slope * x1)} L ${sx2} ${sy2}`,
  );
  return { left: sx2 + 6, top: sy2 - 18 };
}

function drawVertical(x, path) {
  const sx = xPos(x);
  if (sx < 0 || sx > W) return null;
  path.setAttribute("d", `M ${sx} 0 L ${sx} ${H}`);
  return { left: sx + 6, top: 2 };
}

function drawHorizontal(y, path) {
  const sy = yPos(y);
  if (sy < 0 || sy > H) return null;
  path.setAttribute("d", `M 0 ${sy} L ${W} ${sy}`);
  return { left: W + 6, top: sy - 6 };
}

function drawCurve(fn, labelAtEnd, path) {
  let d = "";
  let firstVisible = null;
  let lastVisible = null;
  for (let j = 0; j <= CURVE_SAMPLES; j++) {
    const t = j / CURVE_SAMPLES;
    const px = xRange.min + t * (xRange.max - xRange.min);
    const py = fn(px);
    if (!isFinite(py)) continue;
    const sx = xPos(px);
    const sy = yPos(py);
    const inBounds = sy >= 0 && sy <= H && sx >= 0 && sx <= W;
    if (inBounds) {
      d += (d ? " L " : "M ") + sx.toFixed(1) + " " + sy.toFixed(1);
      if (!firstVisible) firstVisible = { sx, sy };
      lastVisible = { sx, sy };
    } else if (d) {
      const csx = Math.max(0, Math.min(W, sx));
      const csy = Math.max(0, Math.min(H, sy));
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

function updateRefLines() {
  const placed = [];
  refLines.forEach((ref) => {
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
    const overflowsIntoXAxis = top > H - 4;
    label.style.display = overflowsIntoXAxis ? "none" : "";
    label.style.left = left + "px";
    label.style.top = top + "px";
  });
}

function updateLabelMargin() {
  const anyDrawn = refLines.some(
    (ref) => ref.enabled && ref.kind.geometry(ref.data),
  );
  const widest = Math.max(0, ...refLines.map((ref) => ref.labelWidth));
  chartArea.style.right = (anyDrawn ? widest + 14 : 20) + "px";
  measureChart();
}

function measureWhileDisplayed(els, record) {
  const previous = els.map((el) => el.style.display);
  els.forEach((el) => (el.style.display = ""));
  els.forEach((el, i) => record(i, el.offsetWidth));
  els.forEach((el, i) => (el.style.display = previous[i]));
}

function measureLabelWidths() {
  measureWhileDisplayed(labelEls, (i, width) => (labelWidths[i] = width));
  measureWhileDisplayed(
    refLines.map((ref) => ref.label),
    (i, width) => (refLines[i].labelWidth = width),
  );
}

let pinnedDotIndex = null;

function formatUsd(amount) {
  return "$" + amount.toLocaleString("en-US");
}

function tooltipRow(text) {
  const row = document.createElement("div");
  row.textContent = text;
  return row;
}

function showTooltip(i) {
  const m = monitors[i];
  const pinned = pinnedDotIndex === i;
  tooltip.style.display = "block";
  tooltip.classList.toggle("pinned", pinned);
  ttName.textContent = m.name + (m.upcoming ? " (upcoming)" : "");

  const rows = [
    `Size: ${m.wIn.toFixed(1)}" x ${m.hIn.toFixed(1)}"`,
    `Diagonal: ${m.diag}"`,
    `Area: ${m.area.toFixed(0)} in²`,
    `Resolution: ${m.w} x ${m.h}`,
    `Megapixels: ${m.mp.toFixed(1)} MP`,
    `PPI: ${m.ppi.toFixed(0)}`,
    `Aspect Ratio: ${m.ar.toFixed(2)}`,
    `Refresh Rate: ${m.hz} Hz`,
    `Panel: ${m.panel}`,
  ];
  if (m.price != null) {
    const discounted = m.msrp != null && m.msrp > m.price;
    rows.push(
      `Street Price: ${formatUsd(m.price)}` +
        (discounted ? ` (list ${formatUsd(m.msrp)})` : ""),
    );
  }
  if (m.year != null) rows.push(`Released: ${m.year}`);
  ttDetail.replaceChildren(...rows.map(tooltipRow));

  if (m.url && pinned) {
    const link = document.createElement("a");
    link.className = "tt-link";
    link.href = m.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Product page";
    ttDetail.appendChild(link);
  }

  const db = dotEls[i].getBoundingClientRect();
  const width = tooltip.offsetWidth;
  let tx = db.right + 12,
    ty = db.top - 20;
  if (tx + width > window.innerWidth) tx = db.left - 12 - width;
  if (ty < 10) ty = 10;
  tooltip.style.left = tx + "px";
  tooltip.style.top = ty + "px";
}

function unpinDot() {
  if (pinnedDotIndex === null) return;
  dotEls[pinnedDotIndex].classList.remove("pinned");
  pinnedDotIndex = null;
  tooltip.classList.remove("pinned");
  tooltip.style.display = "none";
}

function makeKeyboardButton(el, ariaLabel) {
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", ariaLabel);
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    el.click();
  });
}

function createDots() {
  monitors.forEach((m, i) => {
    const cat = categories[m.cat];
    const dot = document.createElement("div");
    dot.className =
      "dot" +
      (m.upcoming ? " upcoming" : "") +
      (cat.shape === "diamond" ? " diamond" : "");
    setThemedColor(dot, cat);
    makeKeyboardButton(
      dot,
      `${m.name}${m.upcoming ? " (upcoming)" : ""}, ${m.w} x ${m.h}, ${m.diag} inch, ${m.hz} Hz, ${m.panel}`,
    );

    let hoverTimer = null;
    dot.addEventListener("mouseenter", () => {
      if (pinnedDotIndex !== null) return;
      hoverTimer = setTimeout(() => showTooltip(i), 150);
    });
    dot.addEventListener("mouseleave", () => {
      clearTimeout(hoverTimer);
      if (pinnedDotIndex !== null) return;
      tooltip.style.display = "none";
    });
    dot.addEventListener("focus", () => {
      if (pinnedDotIndex === null) showTooltip(i);
    });
    dot.addEventListener("blur", () => {
      if (pinnedDotIndex === null) tooltip.style.display = "none";
    });
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasPinned = pinnedDotIndex === i;
      unpinDot();
      if (wasPinned) return;
      pinnedDotIndex = i;
      dot.classList.add("pinned");
      showTooltip(i);
    });

    chartArea.appendChild(dot);
    dotEls.push(dot);

    const label = document.createElement("div");
    label.className = "monitor-label";
    label.textContent = m.shortName;
    chartArea.appendChild(label);
    labelEls.push(label);
  });

  tooltip.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", unpinDot);
}

const CLUSTER_THRESHOLD = 20;

function buildGroups() {
  const target = targetRanges();
  measureChart();

  const xSpan = target.x.max - target.x.min || 1;
  const ySpan = target.y.max - target.y.min || 1;
  const positions = monitors.map((m) => ({
    x: ((m[xAxisKey] - target.x.min) / xSpan) * W,
    y: H - ((m[yAxisKey] - target.y.min) / ySpan) * H,
  }));

  const parent = monitors.map((_, i) => i);

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  const plottedIndices = [...plotted];
  for (let a = 0; a < plottedIndices.length; a++) {
    for (let b = a + 1; b < plottedIndices.length; b++) {
      const i = plottedIndices[a],
        j = plottedIndices[b];
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_THRESHOLD) {
        const ri = find(i),
          rj = find(j);
        if (ri !== rj) parent[rj] = ri;
      }
    }
  }

  const newGroups = {};
  plottedIndices.forEach((i) => {
    const key = "g" + find(i);
    if (!newGroups[key]) newGroups[key] = { indices: [], expanded: false };
    newGroups[key].indices.push(i);
  });
  return newGroups;
}

function destroyClusters() {
  Object.values(badgeEls).forEach((badge) => badge.remove());
  badgeEls = {};
}

function getExpandedBounds(group) {
  const { cx, cy } = groupCentroid(group.indices);
  const offsets = fanOffsets(group.indices.length);
  let minX = cx,
    maxX = cx,
    minY = cy,
    maxY = cy;
  group.indices.forEach((mi, j) => {
    const x = cx + offsets[j].dx,
      y = cy + offsets[j].dy;
    if (offsets[j].dx < -3) {
      minX = Math.min(minX, x - 10 - labelWidths[mi]);
      maxX = Math.max(maxX, x + 8);
    } else {
      minX = Math.min(minX, x - 8);
      maxX = Math.max(maxX, x + 10 + labelWidths[mi]);
    }
    minY = Math.min(minY, y - 14);
    maxY = Math.max(maxY, y + 14);
  });
  return { left: minX, right: maxX, top: minY, bottom: maxY };
}

function createClusters() {
  Object.entries(groups).forEach(([key, group]) => {
    if (group.indices.length <= 1) return;

    const badge = document.createElement("div");
    badge.className = "cluster-badge";
    badge.textContent = "x" + group.indices.length;
    makeKeyboardButton(
      badge,
      `${group.indices.length} overlapping monitors, toggle to spread them out`,
    );
    badge.addEventListener("click", () => {
      group.indices.forEach((mi) => {
        dotEls[mi].classList.add("fan-animate");
        labelEls[mi].classList.add("fan-animate");
      });
      group.expanded = !group.expanded;

      if (group.expanded) {
        const myBounds = getExpandedBounds(group);
        Object.values(groups).forEach((other) => {
          if (other === group || !other.expanded) return;
          if (rectsOverlap(myBounds, getExpandedBounds(other))) {
            other.expanded = false;
          }
        });
      }

      positionDots();
      setTimeout(() => {
        group.indices.forEach((mi) => {
          dotEls[mi].classList.remove("fan-animate");
          labelEls[mi].classList.remove("fan-animate");
        });
      }, 380);
    });
    chartArea.appendChild(badge);
    badgeEls[key] = badge;
    group.badgeSize = { width: badge.offsetWidth, height: badge.offsetHeight };
  });
}

function rebuildGroupsKeepingExpanded() {
  const wasExpanded = new Set();
  Object.values(groups).forEach((group) => {
    if (group.expanded) group.indices.forEach((i) => wasExpanded.add(i));
  });
  destroyClusters();
  groups = buildGroups();
  Object.values(groups).forEach((group) => {
    if (
      group.indices.length > 1 &&
      group.indices.some((i) => wasExpanded.has(i))
    ) {
      group.expanded = true;
    }
  });
  createClusters();
}

const checkboxEls = [];
const catCheckboxEls = {};
let allMonitorsCb = null;

function unreleasedTag() {
  const tag = document.createElement("span");
  tag.className = "unreleased-tag";
  tag.textContent = "(unreleased)";
  return tag;
}

function monitorCheckbox(i) {
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = visibleMonitors.has(i);
  cb.addEventListener("change", updateVisibility);
  checkboxEls[i] = cb;
  return cb;
}

function buildMonitorPanel() {
  const container = document.getElementById("monitorPanel");
  container.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "monitor-panel";

  const allLabel = document.createElement("label");
  allLabel.className = "monitor-list-category-title monitor-list-all";
  const allCb = document.createElement("input");
  allCb.type = "checkbox";
  allCb.addEventListener("change", () => {
    checkboxEls.forEach((cb) => (cb.checked = allCb.checked));
    updateVisibility();
  });
  allLabel.appendChild(allCb);
  allLabel.appendChild(document.createTextNode("Show all"));
  panel.appendChild(allLabel);
  allMonitorsCb = allCb;

  const list = document.createElement("div");
  list.className = "monitor-list open";

  sortedCategories().forEach(({ key: catKey, indices }) => {
    const cat = categories[catKey];

    if (indices.length === 1) {
      const i = indices[0];
      const label = document.createElement("label");
      label.className = "monitor-list-category-title";
      label.appendChild(monitorCheckbox(i));
      label.appendChild(categorySwatch("cat-dot", cat));
      label.appendChild(document.createTextNode(monitors[i].shortName));
      if (monitors[i].upcoming) label.appendChild(unreleasedTag());
      list.appendChild(label);
      return;
    }

    const section = document.createElement("div");
    section.className = "monitor-list-category";

    const title = document.createElement("label");
    title.className = "monitor-list-category-title";
    const catCb = document.createElement("input");
    catCb.type = "checkbox";
    catCb.addEventListener("change", () => {
      indices.forEach((i) => (checkboxEls[i].checked = catCb.checked));
      updateVisibility();
    });
    catCheckboxEls[catKey] = { cb: catCb, indices };
    title.appendChild(catCb);
    title.appendChild(categorySwatch("cat-dot", cat));
    title.appendChild(document.createTextNode(cat.label));
    section.appendChild(title);

    const items = document.createElement("div");
    items.className = "monitor-list-items";
    indices.forEach((i) => {
      const label = document.createElement("label");
      label.className = "monitor-checkbox-label";
      label.appendChild(monitorCheckbox(i));
      label.appendChild(document.createTextNode(monitors[i].shortName));
      if (monitors[i].upcoming) label.appendChild(unreleasedTag());
      items.appendChild(label);
    });

    section.appendChild(items);
    list.appendChild(section);
  });

  panel.appendChild(list);
  container.appendChild(panel);
  syncGroupCheckboxes();

  // The monitor panel spans the full width, so it sits above the panels row.
  container.parentElement.before(container);
}

function setTriState(cb, checkedCount, total) {
  cb.checked = checkedCount > 0;
  cb.indeterminate = checkedCount > 0 && checkedCount < total;
}

function syncGroupCheckboxes() {
  Object.values(catCheckboxEls).forEach(({ cb, indices }) => {
    const checkedCount = indices.filter((i) => checkboxEls[i].checked).length;
    setTriState(cb, checkedCount, indices.length);
  });
  setTriState(
    allMonitorsCb,
    checkboxEls.filter((cb) => cb.checked).length,
    monitors.length,
  );
}

function updateVisibility() {
  visibleMonitors = new Set(
    monitors.map((_, i) => i).filter((i) => checkboxEls[i].checked),
  );
  syncGroupCheckboxes();
  refreshPlotted();
  rebuildGroupsKeepingExpanded();
  rerender();
  writeUrlState();
}

function onRefLineToggle() {
  relayout();
  writeUrlState();
}

function buildRefLinesPanel() {
  const container = document.getElementById("refLinesPanel");
  container.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "ref-lines-panel";

  REF_KINDS.forEach((kind) => {
    const entries = refLines.filter((ref) => ref.kind === kind);
    const enabledCount = () => entries.filter((ref) => ref.enabled).length;

    const section = document.createElement("div");
    section.className = "ref-lines-section";

    const headingEl = document.createElement("div");
    headingEl.className = "ref-lines-heading";

    const headingText = document.createElement("span");
    headingText.textContent = kind.heading;
    headingEl.appendChild(headingText);

    const allCb = document.createElement("input");
    allCb.type = "checkbox";
    allCb.setAttribute("aria-label", `All ${kind.heading} reference lines`);
    setTriState(allCb, enabledCount(), entries.length);
    headingEl.appendChild(allCb);
    const allText = document.createElement("span");
    allText.className = "ref-lines-all-label";
    allText.textContent = "all";
    headingEl.appendChild(allText);

    section.appendChild(headingEl);

    const items = document.createElement("div");
    items.className = "ref-lines-items";

    const cbs = entries.map((ref) => {
      const label = document.createElement("label");
      label.className = "monitor-checkbox-label";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = ref.enabled;
      cb.addEventListener("change", () => {
        ref.enabled = cb.checked;
        setTriState(allCb, enabledCount(), entries.length);
        onRefLineToggle();
      });
      label.appendChild(cb);
      const dot = document.createElement("div");
      dot.className = "cat-dot";
      setThemedColor(dot, ref.data);
      dot.style.background = "var(--c)";
      label.appendChild(dot);
      label.appendChild(document.createTextNode(ref.data.name));
      items.appendChild(label);
      return cb;
    });

    allCb.addEventListener("change", () => {
      entries.forEach((ref, i) => {
        ref.enabled = allCb.checked;
        cbs[i].checked = allCb.checked;
      });
      onRefLineToggle();
    });

    section.appendChild(items);
    panel.appendChild(section);
  });

  container.appendChild(panel);
}

function buildAxisSelect(selectedKey) {
  const select = document.createElement("select");
  AXIS_GROUPS.forEach((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    group.keys.forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = AXES[key].label;
      if (key === selectedKey) opt.selected = true;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });
  return select;
}

function buildAxisControl(text, selectedKey) {
  const group = document.createElement("label");
  group.className = "axis-control-group";
  const caption = document.createElement("span");
  caption.textContent = text;
  group.appendChild(caption);
  const select = buildAxisSelect(selectedKey);
  group.appendChild(select);
  document.getElementById("axisControls").appendChild(group);
  return select;
}

function buildAxisControls() {
  document.getElementById("axisControls").innerHTML = "";
  const xSelect = buildAxisControl("X:", xAxisKey);
  const ySelect = buildAxisControl("Y:", yAxisKey);
  xSelect.addEventListener("change", () => switchAxes(xSelect.value, yAxisKey));
  ySelect.addEventListener("change", () => switchAxes(xAxisKey, ySelect.value));
}

function updateAxisTitles() {
  document.getElementById("xAxisTitle").textContent =
    AXES[xAxisKey].label + " →";
  document.getElementById("yAxisTitle").textContent =
    AXES[yAxisKey].label + " →";
}

function switchAxes(newX, newY) {
  xAxisKey = newX;
  yAxisKey = newY;
  updateAxisTitles();
  refreshPlotted();
  updateLabelMargin();
  destroyClusters();
  groups = buildGroups();
  createClusters();
  rerender();
  writeUrlState();
}

function drawFrame() {
  measureChart();
  drawGrid();
  updateRefLines();
  positionDots();
}

let animationId = null;
const ANIM_DURATION = 350;

function rerender() {
  const target = targetRanges();
  unpinDot();
  applyPlottedDisplay();

  const startX = { ...xRange };
  const startY = { ...yRange };
  const startTime = performance.now();

  if (animationId) cancelAnimationFrame(animationId);

  function tick(now) {
    const t = Math.min(1, (now - startTime) / ANIM_DURATION);
    const e = 1 - Math.pow(1 - t, 3);

    xRange = {
      min: startX.min + (target.x.min - startX.min) * e,
      max: startX.max + (target.x.max - startX.max) * e,
    };
    yRange = {
      min: startY.min + (target.y.min - startY.min) * e,
      max: startY.max + (target.y.max - startY.max) * e,
    };

    drawFrame();
    animationId = t < 1 ? requestAnimationFrame(tick) : null;
  }

  animationId = requestAnimationFrame(tick);
}

function relayout() {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  updateLabelMargin();
  rebuildGroupsKeepingExpanded();
  const target = targetRanges();
  xRange = target.x;
  yRange = target.y;
  drawFrame();
}

const LIST_SEPARATOR = ".";

function readUrlState() {
  const params = new URLSearchParams(location.hash.slice(1));
  const list = (key) =>
    (params.get(key) || "").split(LIST_SEPARATOR).filter(Boolean);

  if (AXES[params.get("x")]) xAxisKey = params.get("x");
  if (AXES[params.get("y")]) yAxisKey = params.get("y");

  const show = new Set(list("show"));
  const hide = new Set(list("hide"));
  monitors.forEach((m, i) => {
    const visible = (!m.upcoming || show.has(m.id)) && !hide.has(m.id);
    if (visible) visibleMonitors.add(i);
  });

  const refOn = new Set(list("refon"));
  const refOff = new Set(list("refoff"));
  refLines.forEach((ref) => {
    ref.enabled = (ref.enabled || refOn.has(ref.id)) && !refOff.has(ref.id);
  });
}

function writeUrlState() {
  const params = new URLSearchParams();
  const setList = (key, ids) => {
    if (ids.length > 0) params.set(key, ids.join(LIST_SEPARATOR));
  };

  if (xAxisKey !== DEFAULT_X_AXIS) params.set("x", xAxisKey);
  if (yAxisKey !== DEFAULT_Y_AXIS) params.set("y", yAxisKey);

  const shownByDefault = (m) => !m.upcoming;
  const ids = (predicate) =>
    monitors.filter((m, i) => predicate(m, i)).map((m) => m.id);
  setList(
    "show",
    ids((m, i) => visibleMonitors.has(i) && !shownByDefault(m)),
  );
  setList(
    "hide",
    ids((m, i) => !visibleMonitors.has(i) && shownByDefault(m)),
  );

  const refIds = (predicate) => refLines.filter(predicate).map((r) => r.id);
  setList(
    "refon",
    refIds((r) => r.enabled && !r.data.default),
  );
  setList(
    "refoff",
    refIds((r) => !r.enabled && r.data.default),
  );

  const hash = params.toString();
  history.replaceState(
    null,
    "",
    hash ? "#" + hash : location.pathname + location.search,
  );
}

const systemPrefersDark = matchMedia("(prefers-color-scheme: dark)");

function themeChoice() {
  return localStorage.getItem("theme") || "system";
}

function applyTheme() {
  const choice = themeChoice();
  const dark =
    choice === "dark" || (choice === "system" && systemPrefersDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelectorAll("#themeSwitch button").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeChoice === choice),
    );
  });
}

document.querySelectorAll("#themeSwitch button").forEach((button) => {
  button.addEventListener("click", () => {
    localStorage.setItem("theme", button.dataset.themeChoice);
    applyTheme();
  });
});
systemPrefersDark.addEventListener("change", applyTheme);
applyTheme();

async function loadData() {
  const response = await fetch("monitors.json");
  if (!response.ok) {
    throw new Error(`monitors.json returned HTTP ${response.status}.`);
  }
  const data = await response.json();
  data.monitors.forEach((m) => {
    if (!data.categories[m.cat]) {
      throw new Error(`"${m.name}" uses the unknown category "${m.cat}".`);
    }
  });
  return data;
}

function showLoadError(err) {
  console.error(err);
  const message = document.createElement("div");
  message.className = "chart-error";
  message.textContent = "Could not load monitor data. " + err.message;
  chartArea.appendChild(message);
}

function addDerivedProperties(m) {
  const diagPx = Math.sqrt(m.w * m.w + m.h * m.h);
  m.id = slug(m.name);
  m.ppi = diagPx / m.diag;
  m.mp = (m.w * m.h) / 1e6;
  m.wIn = (m.diag * m.w) / diagPx;
  m.hIn = (m.diag * m.h) / diagPx;
  m.area = m.wIn * m.hIn;
  m.ar = m.w / m.h;
}

async function init() {
  const data = await loadData();

  monitors = data.monitors;
  categories = data.categories;
  pricesChecked = data.pricesChecked;
  monitors.forEach(addDerivedProperties);
  refLines = REF_KINDS.flatMap((kind) =>
    data[kind.source].map((entry) => ({
      kind,
      data: entry,
      id: kind.id + "-" + slug(entry.name),
      enabled: Boolean(entry.default),
    })),
  );

  readUrlState();
  refreshPlotted();
  updateAxisTitles();

  buildAxisControls();
  buildMonitorPanel();
  buildRefLinesPanel();
  buildLegend();
  createRefLines();
  createDots();

  measureLabelWidths();
  applyPlottedDisplay();
  relayout();

  // Label widths change once the web fonts replace the fallback fonts.
  document.fonts.ready.then(() => {
    measureLabelWidths();
    relayout();
  });
}

init().catch(showLoadError);

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (monitors.length > 0) relayout();
  }, 150);
});

// writeUrlState uses replaceState, which does not fire hashchange, so this
// only runs when the address bar or a link changes the hash.
window.addEventListener("hashchange", () => location.reload());
