let monitors = [];
let categories = {};
let ratioLines = [];
let mpCurves = [];

const groups = {};
const dotEls = [];
const labelEls = [];
const badgeEls = {};
const resLabelEls = {};

let visibleMonitors = new Set();

let xRange, yRange, W, H, areaOffsetTop, areaOffsetLeft;

const chartArea = document.getElementById('chartArea');
const chartContainer = document.getElementById('chart');
const yLabelsCol = document.getElementById('yLabelsCol');
const tooltip = document.getElementById('tooltip');
const ttName = document.getElementById('ttName');
const ttDetail = document.getElementById('ttDetail');
const legendContainer = document.getElementById('legend');

// Persistent SVG elements for reference lines
const ratioLineEls = [];   // { line, label }
const mpCurveEls = [];     // { path }
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
  xRange = niceRange(monitors.map(m => m.w), 0.15);
  yRange = niceRange(monitors.map(m => m.h), 0.15);
  measureChart();
}

function fanOffsets(n) {
  const radius = 18;
  const offsets = [];
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const angle = startAngle + (2 * Math.PI / n) * i;
    offsets.push({ dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius });
  }
  return offsets;
}

function positionDots() {
  Object.entries(groups).forEach(([key, group]) => {
    const indices = group.indices;
    const m0 = monitors[indices[0]];
    const cx = xPos(m0.w);
    const cy = yPos(m0.h);

    if (indices.length === 1) {
      const i = indices[0];
      dotEls[i].style.left = cx + 'px';
      dotEls[i].style.top = cy + 'px';
      labelEls[i].style.opacity = '1';

      let lx = cx + 10, ly = cy - 4;
      if (cx > W * 0.85) {
        labelEls[i].style.transform = 'translateX(-100%)';
        lx = cx - 10;
      }
      if (cy < H * 0.1) ly = cy + 10;
      labelEls[i].style.left = lx + 'px';
      labelEls[i].style.top = ly + 'px';
    } else if (group.expanded) {
      const offsets = fanOffsets(indices.length);
      indices.forEach((mi, j) => {
        const x = cx + offsets[j].dx;
        const y = cy + offsets[j].dy;
        dotEls[mi].style.left = x + 'px';
        dotEls[mi].style.top = y + 'px';
        labelEls[mi].style.opacity = '1';

        const dx = offsets[j].dx, dy = offsets[j].dy;
        let lx = x + dx * 1.1, ly = y + dy * 1.1;
        labelEls[mi].style.transform = '';
        if (dx < -3) {
          labelEls[mi].style.transform = 'translateX(-100%)';
          lx -= 4;
        } else {
          lx += 8;
        }
        if (dy > 3) ly += 8;
        else if (dy < -3) ly -= 14;
        else ly -= 4;
        labelEls[mi].style.left = lx + 'px';
        labelEls[mi].style.top = ly + 'px';
      });
      if (badgeEls[key]) {
        badgeEls[key].style.left = cx + 'px';
        badgeEls[key].style.top = cy + 'px';
        badgeEls[key].style.opacity = '0.4';
      }
      if (resLabelEls[key]) {
        resLabelEls[key].style.left = cx + 'px';
        resLabelEls[key].style.top = (cy + 20) + 'px';
        resLabelEls[key].style.opacity = '1';
      }
    } else {
      indices.forEach(mi => {
        dotEls[mi].style.left = cx + 'px';
        dotEls[mi].style.top = cy + 'px';
        labelEls[mi].style.opacity = '0';
      });
      if (badgeEls[key]) {
        badgeEls[key].style.left = cx + 'px';
        badgeEls[key].style.top = cy + 'px';
        badgeEls[key].style.opacity = '1';
      }
      if (resLabelEls[key]) {
        resLabelEls[key].style.left = cx + 'px';
        resLabelEls[key].style.top = (cy + 20) + 'px';
        resLabelEls[key].style.opacity = '1';
      }
    }
  });
}

function sortedCategories() {
  const grouped = {};
  monitors.forEach((m, i) => {
    if (!grouped[m.cat]) grouped[m.cat] = { indices: [], totalMp: 0 };
    grouped[m.cat].indices.push(i);
    grouped[m.cat].totalMp += m.megapixels;
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
    lbl.textContent = v.toFixed(0);
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
    lbl.textContent = v.toFixed(0);
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
  ratioLineEls.forEach(({ line, label, data }) => {
    // Compute clipped endpoints in data space
    // Line: y = x / r  (in data coords, h = w / r)
    // Find where it enters and exits the visible range
    const wAtHmin = data.r * yRange.min;
    const wAtHmax = data.r * yRange.max;
    const hAtWmin = xRange.min / data.r;
    const hAtWmax = xRange.max / data.r;

    let x1d = Math.max(xRange.min, wAtHmin);
    let y1d = x1d / data.r;
    let x2d = Math.min(xRange.max, wAtHmax);
    let y2d = x2d / data.r;

    // Clamp to chart bounds
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

    // Position label where it's furthest from any visible dot
    const dotPositions = [];
    monitors.forEach((m, i) => {
      if (visibleMonitors.has(i)) dotPositions.push({ x: xPos(m.w), y: yPos(m.h) });
    });

    let bestT = 0.85, bestDist = -1;
    for (let t = 0.15; t <= 0.9; t += 0.05) {
      const cw = xRange.min + (xRange.max - xRange.min) * t;
      const ch = cw / data.r;
      const cx = xPos(cw), cy = yPos(ch);
      if (cy < 10 || cy > H - 10) continue;
      let minDist = Infinity;
      for (const dp of dotPositions) {
        const d = Math.hypot(cx - dp.x, cy - dp.y);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestDist) { bestDist = minDist; bestT = t; }
    }

    // Offset label perpendicular to the line
    const labelW = xRange.min + (xRange.max - xRange.min) * bestT;
    const labelH = labelW / data.r;
    const dx = sx2 - sx1, dy = sy2 - sy1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const offset = 12;
    label.style.left = (xPos(labelW) + nx * offset) + 'px';
    label.style.top = (yPos(labelH) + ny * offset - 8) + 'px';
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

    mpCurveEls.push({ path, data: curve });
  });
}

function updateMpCurves() {
  mpCurveEls.forEach(({ path, data }) => {
    const k = data.w * data.h;
    // Use fixed number of samples across the full x range
    const pts = [];
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const t = i / CURVE_SAMPLES;
      const px = xRange.min + t * (xRange.max - xRange.min);
      const py = k / px;
      const sx = xPos(px);
      const sy = yPos(py);
      // Clamp to chart bounds
      pts.push({ sx: Math.max(0, Math.min(W, sx)), sy: Math.max(0, Math.min(H, sy)) });
    }
    let d = 'M ' + pts[0].sx.toFixed(1) + ' ' + pts[0].sy.toFixed(1);
    for (let i = 1; i < pts.length; i++) {
      d += ' L ' + pts[i].sx.toFixed(1) + ' ' + pts[i].sy.toFixed(1);
    }
    path.setAttribute('d', d);
  });
}

function createDots() {
  monitors.forEach((m, i) => {
    const dot = document.createElement('div');
    dot.className = 'dot cat-' + m.cat;

    dot.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
      const db = dot.getBoundingClientRect();
      let tx = db.right + 12, ty = db.top - 20;
      if (tx + 260 > window.innerWidth) tx = db.left - 260;
      if (ty < 10) ty = 10;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
      ttName.textContent = m.name;
      const aspect = m.w > m.h * 2.5 ? '32:9' : m.w > m.h * 1.5 ? '21:9' : '~16:9';
      ttDetail.innerHTML =
        'Resolution: ' + m.w + ' x ' + m.h + '<br>' +
        'Diagonal: ' + m.diag + '"<br>' +
        'PPI: ' + m.ppi.toFixed(0) + '<br>' +
        'Total: ' + m.megapixels.toFixed(1) + ' MP<br>' +
        'Aspect: ' + aspect;
    });
    dot.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

    chartArea.appendChild(dot);
    dotEls.push(dot);

    const label = document.createElement('div');
    label.className = 'monitor-label';
    label.textContent = m.shortName;
    chartArea.appendChild(label);
    labelEls.push(label);
  });
}

function createClusters() {
  Object.entries(groups).forEach(([key, group]) => {
    if (group.indices.length <= 1) return;

    const badge = document.createElement('div');
    badge.className = 'cluster-badge';
    badge.textContent = 'x' + group.indices.length;
    badge.addEventListener('click', () => {
      group.expanded = !group.expanded;
      positionDots();
    });
    chartArea.appendChild(badge);
    badgeEls[key] = badge;

    const resLabel = document.createElement('div');
    resLabel.className = 'cluster-res-label';
    const m0 = monitors[group.indices[0]];
    resLabel.textContent = m0.w + 'x' + m0.h;
    chartArea.appendChild(resLabel);
    resLabelEls[key] = resLabel;
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

function updateVisibility() {
  // Sync category checkbox states
  const grouped = {};
  monitors.forEach((m, i) => {
    if (!grouped[m.cat]) grouped[m.cat] = [];
    grouped[m.cat].push(i);
  });
  Object.entries(grouped).forEach(([catKey, indices]) => {
    if (!catCheckboxEls[catKey]) return;
    const visCount = indices.filter(i => visibleMonitors.has(i)).length;
    catCheckboxEls[catKey].checked = visCount > 0;
    catCheckboxEls[catKey].indeterminate = visCount > 0 && visCount < indices.length;
  });

  rerender();
}

let animationId = null;
const ANIM_DURATION = 350;

function rerender() {
  // Compute target ranges
  const visMonitors = monitors.filter((_, i) => visibleMonitors.has(i));
  let targetX, targetY;
  if (visMonitors.length === 0) {
    targetX = { min: 0, max: 8000 };
    targetY = { min: 0, max: 5000 };
  } else {
    targetX = niceRange(visMonitors.map(m => m.w), 0.15);
    targetY = niceRange(visMonitors.map(m => m.h), 0.15);
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
    if (resLabelEls[key]) {
      resLabelEls[key].style.display = visCount === 0 ? 'none' : '';
    }
  });

  const startX = { min: xRange.min, max: xRange.max };
  const startY = { min: yRange.min, max: yRange.max };
  const startTime = performance.now();

  if (animationId) cancelAnimationFrame(animationId);

  function tick(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / ANIM_DURATION);
    // Ease out cubic
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
    positionDots();

    if (t < 1) {
      animationId = requestAnimationFrame(tick);
    } else {
      animationId = null;
    }
  }

  animationId = requestAnimationFrame(tick);
}

function render() {
  computeLayout();
  drawGrid();
  createRefSvg();
  createRatioLines();
  createMpCurves();
  updateRatioLines();
  updateMpCurves();
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

  monitors.forEach(m => {
    m.ppi = Math.sqrt(m.w * m.w + m.h * m.h) / m.diag;
    m.megapixels = (m.w * m.h) / 1e6;
  });

  monitors.forEach((m, i) => {
    const key = m.w + 'x' + m.h;
    if (!groups[key]) groups[key] = { indices: [], expanded: false };
    groups[key].indices.push(i);
  });

  visibleMonitors = new Set(monitors.map((_, i) => i));

  buildMonitorPanel();
  buildLegend();
  render();
}

init();
