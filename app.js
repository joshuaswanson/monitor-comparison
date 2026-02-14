let monitors = [];
let categories = {};
let ratioLines = [];
let mpCurves = [];

let groups = {};
const dotEls = [];
const labelEls = [];
let badgeEls = {};

let visibleMonitors = new Set();
let ratioEnabled = new Set();
let mpEnabled = new Set();

let xRange, yRange, W, H, areaOffsetTop, areaOffsetLeft;

// Axis switching state
let xAxisKey = 'w', yAxisKey = 'h';

const AXES = {
  w:    { label: 'Horizontal Pixels', format: v => v.toFixed(0) },
  h:    { label: 'Vertical Pixels',   format: v => v.toFixed(0) },
  ppi:  { label: 'PPI',               format: v => v.toFixed(0) },
  ar:   { label: 'Aspect Ratio',      format: v => v.toFixed(2) },
  diag: { label: 'Diagonal (in)',     format: v => v.toFixed(1) },
  mp:   { label: 'Megapixels',        format: v => v.toFixed(1) },
  area: { label: 'Screen Area (in²)', format: v => v.toFixed(0) },
  wIn:  { label: 'Width (in)',        format: v => v.toFixed(1) },
  hIn:  { label: 'Height (in)',       format: v => v.toFixed(1) },
};

function getVal(m, key) { return m[key]; }

// Filter state
const filters = {};

const chartArea = document.getElementById('chartArea');
const chartContainer = document.getElementById('chart');
const yLabelsCol = document.getElementById('yLabelsCol');
const tooltip = document.getElementById('tooltip');
const ttName = document.getElementById('ttName');
const ttDetail = document.getElementById('ttDetail');
const legendContainer = document.getElementById('legend');

// Persistent SVG elements for reference lines
const ratioLineEls = [];
const mpCurveEls = [];
let refSvg = null;
let gridLayer = null;

const CURVE_SAMPLES = 200;

function xPos(v) { return (v - xRange.min) / (xRange.max - xRange.min) * W; }
function yPos(v) { return H - (v - yRange.min) / (yRange.max - yRange.min) * H; }

function niceRange(values, padding) {
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const rng = mx - mn || 1;
  return { min: Math.max(0, mn - rng * padding), max: mx + rng * padding };
}

function niceTicks(min, max, count) {
  const rough = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].find(c => c * mag >= rough) * mag;
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
  areaOffsetLeft = rect.left - chartRect.left;
  areaOffsetTop = rect.top - chartRect.top;
}

function computeLayout() {
  const vis = monitors.filter((_, i) => visibleMonitors.has(i));
  const src = vis.length > 0 ? vis : monitors;
  xRange = niceRange(src.map(m => getVal(m, xAxisKey)), 0.15);
  yRange = niceRange(src.map(m => getVal(m, yAxisKey)), 0.15);
  measureChart();
}

function fanOffsets(n, startAngle) {
  const radius = 18;
  const offsets = [];
  if (startAngle === undefined) startAngle = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (2 * Math.PI / n) * i;
    offsets.push({ dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius });
  }
  return offsets;
}

function positionDots() {
  const singletonLabels = [];
  const expandedDotPositions = [];
  const nonExpandedBadges = [];

  // Pass 1: compute all group centroids
  const groupCentroids = {};
  Object.entries(groups).forEach(([key, group]) => {
    const indices = group.indices;
    const cx = indices.reduce((s, i) => s + xPos(getVal(monitors[i], xAxisKey)), 0) / indices.length;
    const cy = indices.reduce((s, i) => s + yPos(getVal(monitors[i], yAxisKey)), 0) / indices.length;
    groupCentroids[key] = { cx, cy };
  });

  // Pass 2: position everything
  Object.entries(groups).forEach(([key, group]) => {
    const indices = group.indices;
    const { cx, cy } = groupCentroids[key];

    if (indices.length === 1) {
      const i = indices[0];
      dotEls[i].style.left = cx + 'px';
      dotEls[i].style.top = cy + 'px';
      labelEls[i].style.opacity = '1';

      let lx = cx + 10, ly = cy - 4;
      let alignRight = false;
      if (cx > W * 0.85) {
        alignRight = true;
        lx = cx - 10;
      }
      if (cy < H * 0.1) ly = cy + 10;

      singletonLabels.push({ idx: i, lx, ly, alignRight, cx, cy });
    } else if (group.expanded) {
      const visIndices = indices.filter(mi => visibleMonitors.has(mi));
      const offsets = fanOffsets(visIndices.length);
      visIndices.forEach((mi, j) => {
        const x = cx + offsets[j].dx;
        const y = cy + offsets[j].dy;
        dotEls[mi].style.left = x + 'px';
        dotEls[mi].style.top = y + 'px';
        dotEls[mi].style.zIndex = '5';
        labelEls[mi].style.opacity = '1';
        labelEls[mi].style.zIndex = '6';

        const dx = offsets[j].dx, dy = offsets[j].dy;
        let lx = x, ly = y;
        labelEls[mi].style.transform = '';
        if (dx < -3) {
          labelEls[mi].style.transform = 'translateX(-100%)';
          lx -= 8;
        } else {
          lx += 8;
        }
        if (dy > 3) ly += 8;
        else if (dy < -3) ly -= 12;
        else ly -= 4;
        labelEls[mi].style.left = lx + 'px';
        labelEls[mi].style.top = ly + 'px';

        const labelW = labelEls[mi].offsetWidth || 70;
        const labelLeft = dx < -3 ? lx - labelW : lx;
        expandedDotPositions.push({ x, y, labelLeft, labelRight: labelLeft + labelW, labelTop: ly, labelBottom: ly + 14 });
      });
      expandedDotPositions.push({ x: cx, y: cy, labelLeft: cx - 10, labelRight: cx + 10, labelTop: cy - 10, labelBottom: cy + 10 });
      // Hidden dots in this group still go to centroid
      indices.filter(mi => !visibleMonitors.has(mi)).forEach(mi => {
        dotEls[mi].style.left = cx + 'px';
        dotEls[mi].style.top = cy + 'px';
      });
      if (badgeEls[key]) {
        badgeEls[key].style.left = cx + 'px';
        badgeEls[key].style.top = cy + 'px';
        badgeEls[key].style.opacity = '0.4';
      }
    } else {
      indices.forEach(mi => {
        dotEls[mi].style.left = cx + 'px';
        dotEls[mi].style.top = cy + 'px';
        dotEls[mi].style.zIndex = '';
        labelEls[mi].style.opacity = '0';
        labelEls[mi].style.zIndex = '';
      });
      if (badgeEls[key]) {
        badgeEls[key].style.left = cx + 'px';
        badgeEls[key].style.top = cy + 'px';
        nonExpandedBadges.push({ el: badgeEls[key], x: cx, y: cy, key, indices });
      }
    }
  });

  // Hide non-expanded badges/dots and singletons that overlap expanded cluster dots/labels
  const dotPad = 12; // padding around dots for overlap check
  function overlapsExpanded(px, py) {
    for (const ep of expandedDotPositions) {
      // Check overlap with expanded dot
      if (Math.abs(px - ep.x) < dotPad * 2 && Math.abs(py - ep.y) < dotPad * 2) return true;
      // Check overlap with expanded label
      if (px + dotPad > ep.labelLeft - 4 && px - dotPad < ep.labelRight + 4 &&
          py + dotPad > ep.labelTop - 2 && py - dotPad < ep.labelBottom + 2) return true;
    }
    return false;
  }

  nonExpandedBadges.forEach(({ el, x, y, indices }) => {
    const tooClose = overlapsExpanded(x, y);
    el.style.opacity = tooClose ? '0' : '1';
    el.style.pointerEvents = tooClose ? 'none' : '';
    indices.forEach(mi => {
      dotEls[mi].style.opacity = tooClose ? '0' : '';
    });
  });

  // Hide singleton dots/labels that overlap expanded cluster dots/labels
  const hiddenSingletons = new Set();
  singletonLabels.forEach(sl => {
    const tooClose = overlapsExpanded(sl.cx, sl.cy);
    if (tooClose) hiddenSingletons.add(sl.idx);
    dotEls[sl.idx].style.opacity = tooClose ? '0' : '';
    labelEls[sl.idx].style.opacity = tooClose ? '0' : '1';
  });

  // Collect all visible dot positions for collision checks (exclude hidden singletons)
  const allDotPositions = [];
  monitors.forEach((_, i) => {
    if (!visibleMonitors.has(i)) return;
    if (hiddenSingletons.has(i)) return;
    allDotPositions.push({
      x: parseFloat(dotEls[i].style.left),
      y: parseFloat(dotEls[i].style.top),
      idx: i
    });
  });

  // Collision avoidance for singleton labels
  const labelHeight = 11;
  const dotR = 8;

  function labelHitsDot(lx, ly, lw, alignR, ownIdx) {
    const lLeft = alignR ? lx - lw : lx;
    const lRight = lLeft + lw;
    for (const dp of allDotPositions) {
      if (dp.idx === ownIdx) continue;
      if (lRight > dp.x - dotR && lLeft < dp.x + dotR &&
          ly + labelHeight > dp.y - dotR && ly < dp.y + dotR) {
        return true;
      }
    }
    return false;
  }

  // Label-dot collision: try nearby positions around own dot
  singletonLabels.forEach(sl => {
    if (hiddenSingletons.has(sl.idx)) return;
    const lw = labelEls[sl.idx].offsetWidth || 70;
    if (!labelHitsDot(sl.lx, sl.ly, lw, sl.alignRight, sl.idx)) return;
    const candidates = [
      { lx: sl.cx + 10, ly: sl.cy - 14, alignRight: false },   // above-right
      { lx: sl.cx + 10, ly: sl.cy + 10, alignRight: false },   // below-right
      { lx: sl.cx - 10, ly: sl.cy - 4,  alignRight: true },    // left
      { lx: sl.cx - 10, ly: sl.cy - 14, alignRight: true },    // above-left
      { lx: sl.cx - 10, ly: sl.cy + 10, alignRight: true },    // below-left
    ];
    for (const c of candidates) {
      if (!labelHitsDot(c.lx, c.ly, lw, c.alignRight, sl.idx)) {
        sl.lx = c.lx;
        sl.ly = c.ly;
        sl.alignRight = c.alignRight;
        return;
      }
    }
  });

  // Label-label collision: nudge overlapping labels vertically
  singletonLabels.sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < singletonLabels.length; i++) {
    const prev = singletonLabels[i - 1];
    const curr = singletonLabels[i];
    if (Math.abs(curr.lx - prev.lx) < 120 && curr.ly - prev.ly < labelHeight) {
      curr.ly = prev.ly + labelHeight;
    }
  }

  // Apply final positions
  singletonLabels.forEach(({ idx, lx, ly, alignRight }) => {
    labelEls[idx].style.transform = alignRight ? 'translateX(-100%)' : '';
    labelEls[idx].style.left = lx + 'px';
    labelEls[idx].style.top = ly + 'px';
  });
}

function sortedCategories() {
  const grouped = {};
  monitors.forEach((m, i) => {
    if (!grouped[m.cat]) grouped[m.cat] = { indices: [], totalMp: 0 };
    grouped[m.cat].indices.push(i);
    grouped[m.cat].totalMp += m.mp;
  });
  return Object.entries(grouped)
    .map(([key, g]) => ({ key, avgMp: g.totalMp / g.indices.length, indices: g.indices }))
    .sort((a, b) => a.avgMp - b.avgMp);
}

function buildLegend() {
  legendContainer.innerHTML = '';
  sortedCategories().forEach(({ key }) => {
    const cat = categories[key];
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.background = cat.color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(cat.label));
    legendContainer.appendChild(item);
  });
}

function drawGrid() {
  if (gridLayer) gridLayer.remove();
  gridLayer = document.createElement('div');
  gridLayer.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;';
  chartArea.insertBefore(gridLayer, chartArea.firstChild);

  yLabelsCol.innerHTML = '';
  chartContainer.querySelectorAll('.axis-label-x').forEach(el => el.remove());

  const yFmt = AXES[yAxisKey].format;
  const xFmt = AXES[xAxisKey].format;

  niceTicks(yRange.min, yRange.max, 7).forEach(v => {
    const y = yPos(v);
    if (y < -5 || y > H + 5) return;
    const line = document.createElement('div');
    line.className = 'grid-line-h';
    line.style.top = y + 'px';
    gridLayer.appendChild(line);
    const lbl = document.createElement('div');
    lbl.className = 'axis-label-y';
    lbl.style.top = (areaOffsetTop + y) + 'px';
    lbl.textContent = yFmt(v);
    yLabelsCol.appendChild(lbl);
  });

  niceTicks(xRange.min, xRange.max, 8).forEach(v => {
    const x = xPos(v);
    if (x < -5 || x > W + 5) return;
    const line = document.createElement('div');
    line.className = 'grid-line-v';
    line.style.left = x + 'px';
    gridLayer.appendChild(line);
    const lbl = document.createElement('div');
    lbl.className = 'axis-label-x';
    lbl.style.left = (areaOffsetLeft + x) + 'px';
    lbl.textContent = xFmt(v);
    chartContainer.appendChild(lbl);
  });
}

function createRefSvg() {
  refSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  refSvg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;';
  chartArea.appendChild(refSvg);
}

function createRatioLines() {
  ratioLines.forEach(rl => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', rl.color);
    line.setAttribute('stroke-opacity', '0.25');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-dasharray', '6 4');
    refSvg.appendChild(line);

    const lbl = document.createElement('div');
    lbl.className = 'ratio-label';
    lbl.style.color = rl.color;
    lbl.style.opacity = '0.5';
    lbl.textContent = rl.name;
    chartArea.appendChild(lbl);

    ratioLineEls.push({ line, label: lbl, data: rl });
  });
}

function updateRatioLines() {
  const isWH = xAxisKey === 'w' && yAxisKey === 'h';
  const xIsAr = xAxisKey === 'ar';
  const yIsAr = yAxisKey === 'ar';

  ratioLineEls.forEach(({ line, label, data }, i) => {
    if (!ratioEnabled.has(i) || (!isWH && !xIsAr && !yIsAr)) {
      // Hide: move offscreen
      line.setAttribute('x1', -100);
      line.setAttribute('y1', -100);
      line.setAttribute('x2', -100);
      line.setAttribute('y2', -100);
      label.style.display = 'none';
      return;
    }

    label.style.display = '';

    if (isWH) {
      // Original diagonal clipping math
      const wAtHmin = data.r * yRange.min;
      const wAtHmax = data.r * yRange.max;

      let x1d = Math.max(xRange.min, wAtHmin);
      let y1d = x1d / data.r;
      let x2d = Math.min(xRange.max, wAtHmax);
      let y2d = x2d / data.r;

      if (y1d < yRange.min) { y1d = yRange.min; x1d = y1d * data.r; }
      if (y1d > yRange.max) { y1d = yRange.max; x1d = y1d * data.r; }
      if (y2d < yRange.min) { y2d = yRange.min; x2d = y2d * data.r; }
      if (y2d > yRange.max) { y2d = yRange.max; x2d = y2d * data.r; }

      const sx1 = xPos(x1d), sy1 = yPos(y1d);
      const sx2 = xPos(x2d), sy2 = yPos(y2d);

      line.setAttribute('x1', sx1);
      line.setAttribute('y1', sy1);
      line.setAttribute('x2', sx2);
      line.setAttribute('y2', sy2);

      // Label positioning: check if line exits at top edge vs right edge
      const atTopEdge = sy2 <= 2;
      const atRightEdge = sx2 >= W - 2;
      if (atTopEdge && !atRightEdge) {
        label.style.left = (sx2 - 6) + 'px';
        label.style.top = (sy2 - 18) + 'px';
      } else {
        label.style.left = (sx2 + 6) + 'px';
        label.style.top = (sy2 - 6) + 'px';
      }
    } else if (xIsAr) {
      // Vertical line at x = ratio value
      const sx = xPos(data.r);
      if (sx < 0 || sx > W) {
        line.setAttribute('x1', -100);
        line.setAttribute('y1', -100);
        line.setAttribute('x2', -100);
        line.setAttribute('y2', -100);
        label.style.display = 'none';
        return;
      }
      line.setAttribute('x1', sx);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', sx);
      line.setAttribute('y2', H);
      label.style.left = (sx + 6) + 'px';
      label.style.top = '2px';
    } else if (yIsAr) {
      // Horizontal line at y = ratio value
      const sy = yPos(data.r);
      if (sy < 0 || sy > H) {
        line.setAttribute('x1', -100);
        line.setAttribute('y1', -100);
        line.setAttribute('x2', -100);
        line.setAttribute('y2', -100);
        label.style.display = 'none';
        return;
      }
      line.setAttribute('x1', 0);
      line.setAttribute('y1', sy);
      line.setAttribute('x2', W);
      line.setAttribute('y2', sy);
      label.style.left = (W + 6) + 'px';
      label.style.top = (sy - 6) + 'px';
    }
  });
}

function createMpCurves() {
  mpCurves.forEach(curve => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', curve.color);
    path.setAttribute('stroke-opacity', '0.2');
    path.setAttribute('stroke-width', '1.2');
    path.setAttribute('stroke-dasharray', '3 3');
    path.setAttribute('fill', 'none');
    refSvg.appendChild(path);

    const lbl = document.createElement('div');
    lbl.className = 'curve-label';
    lbl.style.color = curve.color;
    lbl.style.opacity = '0.4';
    lbl.textContent = curve.name;
    chartArea.appendChild(lbl);

    mpCurveEls.push({ path, label: lbl, data: curve });
  });
}

function updateMpCurves() {
  const isWH = xAxisKey === 'w' && yAxisKey === 'h';

  mpCurveEls.forEach(({ path, label, data }, i) => {
    if (!mpEnabled.has(i) || !isWH) {
      // Hide when not in W/H mode
      path.setAttribute('d', 'M -100 -100');
      label.style.display = 'none';
      return;
    }

    label.style.display = '';
    const k = data.w * data.h;
    const pts = [];
    let lastVisible = null;
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const t = i / CURVE_SAMPLES;
      const px = xRange.min + t * (xRange.max - xRange.min);
      const py = k / px;
      const sx = xPos(px);
      const sy = yPos(py);
      const csx = Math.max(0, Math.min(W, sx));
      const csy = Math.max(0, Math.min(H, sy));
      pts.push({ sx: csx, sy: csy });
      if (sy >= 0 && sy <= H && sx >= 0 && sx <= W) lastVisible = { sx, sy };
    }
    let d = 'M ' + pts[0].sx.toFixed(1) + ' ' + pts[0].sy.toFixed(1);
    for (let i = 1; i < pts.length; i++) {
      d += ' L ' + pts[i].sx.toFixed(1) + ' ' + pts[i].sy.toFixed(1);
    }
    path.setAttribute('d', d);

    // Position label: check if curve exits at top edge vs right edge
    const ep = lastVisible || pts[pts.length - 1];
    const atTopEdge = ep.sy <= 2;
    const atRightEdge = ep.sx >= W - 2;
    if (atTopEdge && !atRightEdge) {
      label.style.left = (ep.sx - 6) + 'px';
      label.style.top = (ep.sy - 18) + 'px';
    } else {
      label.style.left = (ep.sx + 6) + 'px';
      label.style.top = (ep.sy - 6) + 'px';
    }
  });
}

// Nudge reference line/curve labels so they don't overlap
function avoidRefLabelOverlap() {
  const refLabels = [];

  ratioLineEls.forEach(({ label }) => {
    if (label.style.display === 'none') return;
    const top = parseFloat(label.style.top);
    const left = parseFloat(label.style.left);
    if (isNaN(top) || isNaN(left)) return;
    refLabels.push({ el: label, top, left });
  });

  mpCurveEls.forEach(({ label }) => {
    if (label.style.display === 'none') return;
    const top = parseFloat(label.style.top);
    const left = parseFloat(label.style.left);
    if (isNaN(top) || isNaN(left)) return;
    refLabels.push({ el: label, top, left });
  });

  // Sort by vertical position (top value)
  refLabels.sort((a, b) => a.top - b.top);

  const minGap = 14;
  for (let i = 1; i < refLabels.length; i++) {
    const prev = refLabels[i - 1];
    const curr = refLabels[i];
    // Only nudge if horizontally close (both near same edge)
    if (Math.abs(curr.left - prev.left) < 60 && curr.top - prev.top < minGap) {
      curr.top = prev.top + minGap;
      curr.el.style.top = curr.top + 'px';
    }
  }
}

let pinnedDotIndex = null;

function showTooltipForDot(dot, m) {
  tooltip.style.display = 'block';
  const db = dot.getBoundingClientRect();
  let tx = db.right + 12, ty = db.top - 20;
  if (tx + 260 > window.innerWidth) tx = db.left - 260;
  if (ty < 10) ty = 10;
  tooltip.style.left = tx + 'px';
  tooltip.style.top = ty + 'px';
  ttName.textContent = m.name;
  ttDetail.innerHTML =
    'Resolution: ' + m.w + ' x ' + m.h + '<br>' +
    'Diagonal: ' + m.diag + '"<br>' +
    'Size: ' + m.wIn.toFixed(1) + '" x ' + m.hIn.toFixed(1) + '" (' + m.area.toFixed(0) + ' in&sup2;)<br>' +
    'PPI: ' + m.ppi.toFixed(0) + '<br>' +
    'Total: ' + m.mp.toFixed(1) + ' MP<br>' +
    'Aspect: ' + m.ar.toFixed(2) + ' (' + m.w + ':' + m.h + ')';
}

function unpinDot() {
  if (pinnedDotIndex !== null) {
    dotEls[pinnedDotIndex].classList.remove('pinned');
    pinnedDotIndex = null;
    tooltip.style.display = 'none';
  }
}

function createDots() {
  monitors.forEach((m, i) => {
    const dot = document.createElement('div');
    dot.className = 'dot cat-' + m.cat;

    dot.addEventListener('mouseenter', () => {
      if (pinnedDotIndex !== null && pinnedDotIndex !== i) return;
      showTooltipForDot(dot, m);
    });
    dot.addEventListener('mouseleave', () => {
      if (pinnedDotIndex === i) return;
      tooltip.style.display = 'none';
    });
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pinnedDotIndex === i) {
        unpinDot();
      } else {
        unpinDot();
        pinnedDotIndex = i;
        dot.classList.add('pinned');
        // Only reposition if tooltip isn't already visible (e.g. touch)
        if (tooltip.style.display !== 'block') {
          showTooltipForDot(dot, m);
        }
      }
    });

    chartArea.appendChild(dot);
    dotEls.push(dot);

    const label = document.createElement('div');
    label.className = 'monitor-label';
    label.textContent = m.shortName;
    chartArea.appendChild(label);
    labelEls.push(label);
  });

  // Click anywhere else to unpin
  document.addEventListener('click', () => { unpinDot(); });
}

// Build groups based on screen-space proximity (union-find clustering)
const CLUSTER_THRESHOLD = 20; // pixels -- dots closer than this collapse

function buildGroups() {
  // Compute target ranges to get screen positions
  const vis = monitors.filter((_, i) => visibleMonitors.has(i));
  const src = vis.length > 0 ? vis : monitors;
  const tX = niceRange(src.map(m => getVal(m, xAxisKey)), 0.15);
  const tY = niceRange(src.map(m => getVal(m, yAxisKey)), 0.15);

  measureChart();

  const tXSpan = tX.max - tX.min || 1;
  const tYSpan = tY.max - tY.min || 1;
  function tmpXPos(v) { return (v - tX.min) / tXSpan * W; }
  function tmpYPos(v) { return H - (v - tY.min) / tYSpan * H; }

  const positions = monitors.map(m => ({
    x: tmpXPos(getVal(m, xAxisKey)),
    y: tmpYPos(getVal(m, yAxisKey)),
  }));

  // Union-Find
  const parent = monitors.map((_, i) => i);

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  for (let i = 0; i < monitors.length; i++) {
    for (let j = i + 1; j < monitors.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_THRESHOLD) {
        union(i, j);
      }
    }
  }

  const newGroups = {};
  for (let i = 0; i < monitors.length; i++) {
    const root = find(i);
    const key = 'g' + root;
    if (!newGroups[key]) newGroups[key] = { indices: [], expanded: false };
    newGroups[key].indices.push(i);
  }

  return newGroups;
}

function destroyClusters() {
  Object.keys(badgeEls).forEach(key => {
    if (badgeEls[key]) badgeEls[key].remove();
  });
  badgeEls = {};
}

function createClusters() {
  Object.entries(groups).forEach(([key, group]) => {
    if (group.indices.length <= 1) return;

    const badge = document.createElement('div');
    badge.className = 'cluster-badge';
    badge.textContent = 'x' + group.indices.length;
    badge.addEventListener('click', () => {
      // Add animation class before toggling
      group.indices.forEach(mi => {
        dotEls[mi].classList.add('fan-animate');
        labelEls[mi].classList.add('fan-animate');
      });
      group.expanded = !group.expanded;
      positionDots();
      // Remove animation class after transition completes
      setTimeout(() => {
        group.indices.forEach(mi => {
          dotEls[mi].classList.remove('fan-animate');
          labelEls[mi].classList.remove('fan-animate');
        });
      }, 380);
    });
    chartArea.appendChild(badge);
    badgeEls[key] = badge;

  });
}

const checkboxEls = [];
const catCheckboxEls = {};

function buildMonitorPanel() {
  const container = document.getElementById('monitorPanel');
  container.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'monitor-panel';

  const toggle = document.createElement('button');
  toggle.className = 'panel-toggle';
  toggle.innerHTML = 'show/hide monitors <span class="arrow">&#9662;</span>';
  panel.appendChild(toggle);

  const list = document.createElement('div');
  list.className = 'monitor-list';

  sortedCategories().forEach(({ key: catKey, indices }) => {
    const cat = categories[catKey];

    if (indices.length === 1) {
      const i = indices[0];
      const label = document.createElement('label');
      label.className = 'monitor-list-category-title';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.addEventListener('change', () => {
        if (cb.checked) {
          visibleMonitors.add(i);
        } else {
          visibleMonitors.delete(i);
        }
        updateVisibility();
      });
      label.appendChild(cb);
      const catDot = document.createElement('div');
      catDot.className = 'cat-dot';
      catDot.style.background = cat.color;
      label.appendChild(catDot);
      label.appendChild(document.createTextNode(monitors[i].shortName));
      checkboxEls[i] = cb;
      catCheckboxEls[catKey] = cb;
      list.appendChild(label);
      return;
    }

    const section = document.createElement('div');
    section.className = 'monitor-list-category';

    const title = document.createElement('label');
    title.className = 'monitor-list-category-title';
    const catCb = document.createElement('input');
    catCb.type = 'checkbox';
    catCb.checked = true;
    catCb.addEventListener('change', () => {
      indices.forEach(i => {
        if (catCb.checked) {
          visibleMonitors.add(i);
        } else {
          visibleMonitors.delete(i);
        }
        if (checkboxEls[i]) checkboxEls[i].checked = catCb.checked;
      });
      updateVisibility();
    });
    catCheckboxEls[catKey] = catCb;
    title.appendChild(catCb);
    const catDot = document.createElement('div');
    catDot.className = 'cat-dot';
    catDot.style.background = cat.color;
    title.appendChild(catDot);
    title.appendChild(document.createTextNode(cat.label));
    section.appendChild(title);

    const items = document.createElement('div');
    items.className = 'monitor-list-items';

    indices.forEach(i => {
      const label = document.createElement('label');
      label.className = 'monitor-checkbox-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.addEventListener('change', () => {
        if (cb.checked) {
          visibleMonitors.add(i);
        } else {
          visibleMonitors.delete(i);
        }
        updateVisibility();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(monitors[i].shortName));
      items.appendChild(label);
      checkboxEls[i] = cb;
    });

    section.appendChild(items);
    list.appendChild(section);
  });

  toggle.addEventListener('click', () => {
    list.classList.toggle('open');
    toggle.classList.toggle('open');
  });

  panel.appendChild(list);
  container.appendChild(panel);
}

// Filter panel
let filterDebounceTimer = null;

function buildFilterPanel() {
  const container = document.getElementById('filterPanel');
  container.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'filter-panel';

  const toggle = document.createElement('button');
  toggle.className = 'panel-toggle';
  toggle.innerHTML = 'filters <span class="arrow">&#9662;</span>';
  panel.appendChild(toggle);

  const list = document.createElement('div');
  list.className = 'filter-list';

  const filterDefs = [
    { key: 'w',    label: 'Horizontal Pixels', step: 1,    decimals: 0 },
    { key: 'h',    label: 'Vertical Pixels',   step: 1,    decimals: 0 },
    { key: 'ppi',  label: 'PPI',               step: 1,    decimals: 0 },
    { key: 'ar',   label: 'Aspect Ratio',      step: 0.01, decimals: 2 },
    { key: 'diag', label: 'Diagonal (in)',      step: 0.1,  decimals: 1 },
    { key: 'mp',   label: 'Megapixels',        step: 0.1,  decimals: 1 },
    { key: 'area', label: 'Screen Area (in²)', step: 1,    decimals: 0 },
    { key: 'wIn',  label: 'Width (in)',        step: 0.1,  decimals: 1 },
    { key: 'hIn',  label: 'Height (in)',       step: 0.1,  decimals: 1 },
  ];

  filterDefs.forEach(({ key, label, step, decimals }) => {
    const values = monitors.map(m => getVal(m, key));
    const dataMin = Math.floor(Math.min(...values) / step) * step;
    const dataMax = Math.ceil(Math.max(...values) / step) * step;

    const row = document.createElement('div');
    row.className = 'filter-row';

    const rowLabel = document.createElement('span');
    rowLabel.className = 'filter-row-label';
    rowLabel.textContent = label;
    row.appendChild(rowLabel);

    const slidersDiv = document.createElement('div');
    slidersDiv.className = 'filter-sliders';

    const minValueLabel = document.createElement('span');
    minValueLabel.className = 'filter-value-label';
    minValueLabel.textContent = dataMin.toFixed(decimals);

    const dualRange = document.createElement('div');
    dualRange.className = 'dual-range';

    const track = document.createElement('div');
    track.className = 'dual-range-track';
    dualRange.appendChild(track);

    const fill = document.createElement('div');
    fill.className = 'dual-range-fill';
    dualRange.appendChild(fill);

    const minSlider = document.createElement('input');
    minSlider.type = 'range';
    minSlider.className = 'dual-range-input';
    minSlider.min = dataMin;
    minSlider.max = dataMax;
    minSlider.step = step;
    minSlider.value = dataMin;

    const maxSlider = document.createElement('input');
    maxSlider.type = 'range';
    maxSlider.className = 'dual-range-input';
    maxSlider.min = dataMin;
    maxSlider.max = dataMax;
    maxSlider.step = step;
    maxSlider.value = dataMax;

    const maxValueLabel = document.createElement('span');
    maxValueLabel.className = 'filter-value-label';
    maxValueLabel.textContent = dataMax.toFixed(decimals);

    function updateFill() {
      const range = dataMax - dataMin || 1;
      const left = ((parseFloat(minSlider.value) - dataMin) / range) * 100;
      const right = ((parseFloat(maxSlider.value) - dataMin) / range) * 100;
      fill.style.left = left + '%';
      fill.style.width = (right - left) + '%';
    }
    updateFill();

    minSlider.addEventListener('input', () => {
      let v = parseFloat(minSlider.value);
      if (v > parseFloat(maxSlider.value)) {
        v = parseFloat(maxSlider.value);
        minSlider.value = v;
      }
      minValueLabel.textContent = v.toFixed(decimals);
      updateFill();
      onSliderInput(key, v, parseFloat(maxSlider.value), dataMin, dataMax);
    });

    maxSlider.addEventListener('input', () => {
      let v = parseFloat(maxSlider.value);
      if (v < parseFloat(minSlider.value)) {
        v = parseFloat(minSlider.value);
        maxSlider.value = v;
      }
      maxValueLabel.textContent = v.toFixed(decimals);
      updateFill();
      onSliderInput(key, parseFloat(minSlider.value), v, dataMin, dataMax);
    });

    dualRange.appendChild(minSlider);
    dualRange.appendChild(maxSlider);

    slidersDiv.appendChild(minValueLabel);
    slidersDiv.appendChild(dualRange);
    slidersDiv.appendChild(maxValueLabel);
    row.appendChild(slidersDiv);

    list.appendChild(row);
  });

  toggle.addEventListener('click', () => {
    list.classList.toggle('open');
    toggle.classList.toggle('open');
  });

  panel.appendChild(list);
  container.appendChild(panel);
}

function onSliderInput(key, minVal, maxVal, dataMin, dataMax) {
  clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(() => {
    if (!filters[key]) filters[key] = {};
    if (minVal > dataMin) {
      filters[key].min = minVal;
    } else {
      delete filters[key].min;
    }
    if (maxVal < dataMax) {
      filters[key].max = maxVal;
    } else {
      delete filters[key].max;
    }
    if (Object.keys(filters[key]).length === 0) delete filters[key];
    applyFilters();
  }, 30);
}

function passesFilters(m) {
  for (const [key, bounds] of Object.entries(filters)) {
    const val = getVal(m, key);
    if (bounds.min !== undefined && val < bounds.min) return false;
    if (bounds.max !== undefined && val > bounds.max) return false;
  }
  return true;
}

function buildRatioPanel() {
  const container = document.getElementById('ratioPanel');
  container.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'filter-panel';

  const toggle = document.createElement('button');
  toggle.className = 'panel-toggle';
  toggle.innerHTML = 'show/hide aspect ratio lines <span class="arrow">&#9662;</span>';
  panel.appendChild(toggle);

  const list = document.createElement('div');
  list.className = 'ref-list';

  const allLabel = document.createElement('label');
  allLabel.className = 'monitor-checkbox-label ref-all-toggle';
  const allCb = document.createElement('input');
  allCb.type = 'checkbox';
  allCb.checked = ratioEnabled.size > 0;
  allCb.indeterminate = ratioEnabled.size > 0 && ratioEnabled.size < ratioLines.length;
  list.appendChild(allLabel);

  const items = document.createElement('div');
  items.className = 'ref-list-items narrow';

  const ratioCbs = [];
  ratioLines.forEach((rl, i) => {
    const label = document.createElement('label');
    label.className = 'monitor-checkbox-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = ratioEnabled.has(i);
    cb.addEventListener('change', () => {
      if (cb.checked) {
        ratioEnabled.add(i);
      } else {
        ratioEnabled.delete(i);
      }
      allCb.checked = ratioEnabled.size > 0;
      allCb.indeterminate = ratioEnabled.size > 0 && ratioEnabled.size < ratioLines.length;
      updateLabelMargin();
      updateRatioLines();
      avoidRefLabelOverlap();
    });
    ratioCbs.push(cb);
    label.appendChild(cb);
    const dot = document.createElement('div');
    dot.className = 'cat-dot';
    dot.style.background = rl.color;
    label.appendChild(dot);
    label.appendChild(document.createTextNode(rl.name));
    items.appendChild(label);
  });

  allCb.addEventListener('change', () => {
    ratioLines.forEach((_, i) => {
      if (allCb.checked) {
        ratioEnabled.add(i);
      } else {
        ratioEnabled.delete(i);
      }
      ratioCbs[i].checked = allCb.checked;
    });
    allCb.indeterminate = false;
    updateLabelMargin();
    updateRatioLines();
    avoidRefLabelOverlap();
  });
  allLabel.appendChild(allCb);
  allLabel.appendChild(document.createTextNode('all'));

  list.appendChild(items);

  toggle.addEventListener('click', () => {
    list.classList.toggle('open');
    toggle.classList.toggle('open');
  });

  panel.appendChild(list);
  container.appendChild(panel);
}

function buildMpPanel() {
  const container = document.getElementById('mpPanel');
  container.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'filter-panel';

  const toggle = document.createElement('button');
  toggle.className = 'panel-toggle';
  toggle.innerHTML = 'show/hide megapixel curves <span class="arrow">&#9662;</span>';
  panel.appendChild(toggle);

  const list = document.createElement('div');
  list.className = 'ref-list';

  const allLabel = document.createElement('label');
  allLabel.className = 'monitor-checkbox-label ref-all-toggle';
  const allCb = document.createElement('input');
  allCb.type = 'checkbox';
  allCb.checked = mpEnabled.size > 0;
  allCb.indeterminate = mpEnabled.size > 0 && mpEnabled.size < mpCurves.length;
  list.appendChild(allLabel);

  const items = document.createElement('div');
  items.className = 'ref-list-items';

  const mpCbs = [];
  mpCurves.forEach((mc, i) => {
    const label = document.createElement('label');
    label.className = 'monitor-checkbox-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = mpEnabled.has(i);
    cb.addEventListener('change', () => {
      if (cb.checked) {
        mpEnabled.add(i);
      } else {
        mpEnabled.delete(i);
      }
      allCb.checked = mpEnabled.size > 0;
      allCb.indeterminate = mpEnabled.size > 0 && mpEnabled.size < mpCurves.length;
      updateLabelMargin();
      updateMpCurves();
      avoidRefLabelOverlap();
    });
    mpCbs.push(cb);
    label.appendChild(cb);
    const dot = document.createElement('div');
    dot.className = 'cat-dot';
    dot.style.background = mc.color;
    label.appendChild(dot);
    label.appendChild(document.createTextNode(mc.name));
    items.appendChild(label);
  });

  allCb.addEventListener('change', () => {
    mpCurves.forEach((_, i) => {
      if (allCb.checked) {
        mpEnabled.add(i);
      } else {
        mpEnabled.delete(i);
      }
      mpCbs[i].checked = allCb.checked;
    });
    allCb.indeterminate = false;
    updateLabelMargin();
    updateMpCurves();
    avoidRefLabelOverlap();
  });
  allLabel.appendChild(allCb);
  allLabel.appendChild(document.createTextNode('all'));

  list.appendChild(items);

  toggle.addEventListener('click', () => {
    list.classList.toggle('open');
    toggle.classList.toggle('open');
  });

  panel.appendChild(list);
  container.appendChild(panel);
}

function applyFilters() {
  monitors.forEach((m, i) => {
    const checkboxOn = checkboxEls[i] ? checkboxEls[i].checked : true;
    if (checkboxOn && passesFilters(m)) {
      visibleMonitors.add(i);
    } else {
      visibleMonitors.delete(i);
    }
  });
  updateVisibility();
}

function updateVisibility() {
  // Re-apply filter logic to sync checkbox + filter state
  monitors.forEach((m, i) => {
    const checkboxOn = checkboxEls[i] ? checkboxEls[i].checked : true;
    if (checkboxOn && passesFilters(m)) {
      visibleMonitors.add(i);
    } else {
      visibleMonitors.delete(i);
    }
  });

  // Sync category checkbox states (based on individual checkbox states, not visibility,
  // so that filters don't permanently uncheck monitors)
  const grouped = {};
  monitors.forEach((m, i) => {
    if (!grouped[m.cat]) grouped[m.cat] = [];
    grouped[m.cat].push(i);
  });
  Object.entries(grouped).forEach(([catKey, indices]) => {
    if (!catCheckboxEls[catKey]) return;
    if (indices.length === 1) return; // single-monitor: checkbox IS the control
    const checkedCount = indices.filter(i => checkboxEls[i] && checkboxEls[i].checked).length;
    catCheckboxEls[catKey].checked = checkedCount > 0;
    catCheckboxEls[catKey].indeterminate = checkedCount > 0 && checkedCount < indices.length;
  });

  // Animate dots in expanded clusters only if that group's visible count changed
  const animatingDots = [];
  Object.values(groups).forEach(group => {
    if (!group.expanded || group.indices.length <= 1) return;
    const newVisCount = group.indices.filter(mi => visibleMonitors.has(mi)).length;
    const oldVisCount = group._lastVisCount;
    group._lastVisCount = newVisCount;
    if (oldVisCount !== undefined && oldVisCount !== newVisCount) {
      group.indices.forEach(mi => {
        if (visibleMonitors.has(mi)) {
          dotEls[mi].classList.add('fan-animate');
          labelEls[mi].classList.add('fan-animate');
          animatingDots.push(mi);
        }
      });
    }
  });
  if (animatingDots.length > 0) {
    setTimeout(() => {
      animatingDots.forEach(mi => {
        dotEls[mi].classList.remove('fan-animate');
        labelEls[mi].classList.remove('fan-animate');
      });
    }, 400);
  }

  rerender();
}

// Axis controls
const AXIS_GROUPS = [
  { label: 'Resolution', keys: ['w', 'h', 'mp'] },
  { label: 'Physical Size', keys: ['wIn', 'hIn', 'diag', 'area'] },
  { label: 'Density / Ratio', keys: ['ppi', 'ar'] },
];

function buildAxisSelect(selectedKey) {
  const select = document.createElement('select');
  AXIS_GROUPS.forEach(group => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;
    group.keys.forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = AXES[key].label;
      if (key === selectedKey) opt.selected = true;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });
  return select;
}

function buildAxisControls() {
  const container = document.getElementById('axisControls');
  container.innerHTML = '';

  // X axis
  const xGroup = document.createElement('div');
  xGroup.className = 'axis-control-group';
  const xLabel = document.createElement('label');
  xLabel.textContent = 'X:';
  xGroup.appendChild(xLabel);
  const xSelect = buildAxisSelect(xAxisKey);
  xGroup.appendChild(xSelect);
  container.appendChild(xGroup);

  // Y axis
  const yGroup = document.createElement('div');
  yGroup.className = 'axis-control-group';
  const yLabel = document.createElement('label');
  yLabel.textContent = 'Y:';
  yGroup.appendChild(yLabel);
  const ySelect = buildAxisSelect(yAxisKey);
  yGroup.appendChild(ySelect);
  container.appendChild(yGroup);

  xSelect.addEventListener('change', () => switchAxes(xSelect.value, yAxisKey));
  ySelect.addEventListener('change', () => switchAxes(xAxisKey, ySelect.value));
}

function switchAxes(newX, newY) {
  xAxisKey = newX;
  yAxisKey = newY;

  // Update axis title text
  document.getElementById('xAxisTitle').innerHTML = AXES[xAxisKey].label + ' &#8594;';
  document.getElementById('yAxisTitle').innerHTML = AXES[yAxisKey].label + ' &#8594;';

  // Rebuild groups for new axes
  destroyClusters();
  groups = buildGroups();
  createClusters();

  // Update note text and label margin based on axis mode
  updateNoteBar();
  updateLabelMargin();

  rerender();
}

function updateNoteBar() {
  const isWH = xAxisKey === 'w' && yAxisKey === 'h';
  const hasAr = xAxisKey === 'ar' || yAxisKey === 'ar';

  const noteRatio = document.getElementById('noteRatio');
  const noteMp = document.getElementById('noteMp');
  const noteSep1 = document.getElementById('noteSep1');
  const noteSep2 = document.getElementById('noteSep2');

  if (isWH) {
    noteRatio.style.display = '';
    noteRatio.textContent = '--- diagonal = aspect ratio';
    noteSep1.style.display = '';
    noteMp.style.display = '';
    noteMp.textContent = '~~~ curve = same megapixels';
    noteSep2.style.display = '';
  } else if (hasAr) {
    noteRatio.style.display = '';
    noteRatio.textContent = '--- line = aspect ratio';
    noteSep1.style.display = 'none';
    noteMp.style.display = 'none';
    noteSep2.style.display = '';
  } else {
    noteRatio.style.display = 'none';
    noteSep1.style.display = 'none';
    noteMp.style.display = 'none';
    noteSep2.style.display = 'none';
  }
}

let animationId = null;
const ANIM_DURATION = 350;

function rerender() {
  // Compute target ranges from visible monitors
  const visMonitors = monitors.filter((_, i) => visibleMonitors.has(i));
  let targetX, targetY;
  if (visMonitors.length === 0) {
    targetX = { min: 0, max: 8000 };
    targetY = { min: 0, max: 5000 };
  } else {
    targetX = niceRange(visMonitors.map(m => getVal(m, xAxisKey)), 0.15);
    targetY = niceRange(visMonitors.map(m => getVal(m, yAxisKey)), 0.15);
  }

  // Apply visibility immediately
  monitors.forEach((_, i) => {
    const show = visibleMonitors.has(i);
    dotEls[i].style.display = show ? '' : 'none';
    labelEls[i].style.display = show ? '' : 'none';
  });

  Object.entries(groups).forEach(([key, group]) => {
    if (group.indices.length <= 1) return;
    const visCount = group.indices.filter(i => visibleMonitors.has(i)).length;
    if (badgeEls[key]) {
      if (visCount <= 1) {
        badgeEls[key].style.display = 'none';
      } else {
        badgeEls[key].style.display = '';
        badgeEls[key].textContent = 'x' + visCount;
      }
    }
  });

  const startX = { min: xRange.min, max: xRange.max };
  const startY = { min: yRange.min, max: yRange.max };
  const startTime = performance.now();

  if (animationId) cancelAnimationFrame(animationId);

  function tick(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / ANIM_DURATION);
    const e = 1 - Math.pow(1 - t, 3);

    xRange = {
      min: startX.min + (targetX.min - startX.min) * e,
      max: startX.max + (targetX.max - startX.max) * e,
    };
    yRange = {
      min: startY.min + (targetY.min - startY.min) * e,
      max: startY.max + (targetY.max - startY.max) * e,
    };

    measureChart();
    drawGrid();
    updateRatioLines();
    updateMpCurves();
    avoidRefLabelOverlap();
    positionDots();

    if (t < 1) {
      animationId = requestAnimationFrame(tick);
    } else {
      animationId = null;
    }
  }

  animationId = requestAnimationFrame(tick);
}

let labelMarginRight = 20;

function measureLabelMargin() {
  let maxW = 0;
  ratioLineEls.forEach(({ label }) => {
    maxW = Math.max(maxW, label.offsetWidth);
  });
  mpCurveEls.forEach(({ label }) => {
    maxW = Math.max(maxW, label.offsetWidth);
  });
  labelMarginRight = maxW + 14;
  chartArea.style.right = labelMarginRight + 'px';
  measureChart();
}

function updateLabelMargin() {
  const isWH = xAxisKey === 'w' && yAxisKey === 'h';
  const hasAr = xAxisKey === 'ar' || yAxisKey === 'ar';
  const hasRatio = ratioEnabled.size > 0;
  const hasMp = mpEnabled.size > 0;
  const needsMargin = (isWH && (hasRatio || hasMp)) || (hasAr && hasRatio);
  chartArea.style.right = needsMargin ? labelMarginRight + 'px' : '20px';
  measureChart();
}

function render() {
  computeLayout();
  createRefSvg();
  createRatioLines();
  createMpCurves();
  measureLabelMargin();
  drawGrid();
  updateRatioLines();
  updateMpCurves();
  avoidRefLabelOverlap();
  createDots();
  createClusters();
  positionDots();
}

async function init() {
  const response = await fetch('monitors.json');
  const data = await response.json();

  monitors = data.monitors;
  categories = data.categories;
  ratioLines = data.ratioLines;
  mpCurves = data.mpCurves;

  // Compute derived properties
  monitors.forEach(m => {
    m.ppi = Math.sqrt(m.w * m.w + m.h * m.h) / m.diag;
    m.mp = (m.w * m.h) / 1e6;
    const hyp = Math.sqrt(m.w * m.w + m.h * m.h);
    m.wIn = m.diag * m.w / hyp;
    m.hIn = m.diag * m.h / hyp;
    m.area = m.wIn * m.hIn;
    m.ar = m.w / m.h;
  });

  visibleMonitors = new Set(monitors.map((_, i) => i));

  // Initialize enabled sets from defaults
  ratioLines.forEach((rl, i) => { if (rl.default) ratioEnabled.add(i); });
  mpCurves.forEach((mc, i) => { if (mc.default) mpEnabled.add(i); });

  // Build initial groups (after visibleMonitors is set)
  groups = buildGroups();

  buildAxisControls();
  buildMonitorPanel();
  buildFilterPanel();
  buildRatioPanel();
  buildMpPanel();
  buildLegend();
  updateNoteBar();
  render();
}

init();
