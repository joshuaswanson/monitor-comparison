import { xPos, yPos } from "./scale.js";
import { state, dotEls, labelEls, labelWidths } from "./state.js";
import { rectsOverlap, rectAround } from "./util.js";

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
    indices.reduce((s, i) => s + xPos(state.monitors[i][state.xAxisKey]), 0) /
    indices.length;
  const cy =
    indices.reduce((s, i) => s + yPos(state.monitors[i][state.yAxisKey]), 0) /
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
  const alignRight = cx > state.chartWidth * 0.85;
  return {
    lx: alignRight ? cx - 12 : cx + 12,
    ly: cy < state.chartHeight * 0.1 ? cy + 10 : cy - 4,
    alignRight,
  };
}

function labelRect(lx, ly, lw, alignRight) {
  const left = alignRight ? lx - lw : lx;
  return { left, right: left + lw, top: ly, bottom: ly + LABEL_HEIGHT };
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

  state.badgeEls[key].style.left = cx + "px";
  state.badgeEls[key].style.top = cy + "px";
  state.badgeEls[key].style.opacity = "0.4";
  state.badgeEls[key].style.pointerEvents = "";
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
  state.badgeEls[key].style.left = cx + "px";
  state.badgeEls[key].style.top = cy + "px";
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
    const el = state.badgeEls[badge.key];
    el.style.opacity = badge.hidden ? "0" : "1";
    el.style.pointerEvents = badge.hidden ? "none" : "";
    badge.group.indices.forEach((mi) => {
      dotEls[mi].style.opacity = badge.hidden ? "0" : "";
    });
  });

  layout.singletonLabels.forEach((sl) => {
    sl.hidden = coveredByExpandedCluster(
      sl.cx,
      sl.cy,
      layout.expandedObstacles,
    );
    dotEls[sl.idx].style.opacity = sl.hidden ? "0" : "";
    labelEls[sl.idx].style.opacity = sl.hidden ? "0" : "1";
  });
}

function labelObstacles(layout) {
  const hiddenSingletons = new Set(
    layout.singletonLabels.filter((sl) => sl.hidden).map((sl) => sl.idx),
  );
  const dots = [...state.plotted]
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

export function positionDots() {
  const layout = {
    singletonLabels: [],
    expandedObstacles: [],
    collapsedBadges: [],
  };

  Object.entries(state.groups).forEach(([key, group]) => {
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

export function getExpandedBounds(group) {
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
