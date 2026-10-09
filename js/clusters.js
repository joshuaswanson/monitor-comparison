import { chartArea } from "./dom.js";
import { positionDots, getExpandedBounds } from "./layout.js";
import { measureChart, targetRanges } from "./scale.js";
import { state, dotEls, labelEls } from "./state.js";
import { rectsOverlap, makeKeyboardButton } from "./util.js";

const CLUSTER_THRESHOLD = 20;

export function buildGroups() {
  const target = targetRanges();
  measureChart();

  const xSpan = target.x.max - target.x.min || 1;
  const ySpan = target.y.max - target.y.min || 1;
  const positions = state.monitors.map((m) => ({
    x: ((m[state.xAxisKey] - target.x.min) / xSpan) * state.chartWidth,
    y:
      state.chartHeight -
      ((m[state.yAxisKey] - target.y.min) / ySpan) * state.chartHeight,
  }));

  const parent = state.monitors.map((_, i) => i);

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  const plottedIndices = [...state.plotted];
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

export function destroyClusters() {
  Object.values(state.badgeEls).forEach((badge) => badge.remove());
  state.badgeEls = {};
}

export function createClusters() {
  Object.entries(state.groups).forEach(([key, group]) => {
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
        Object.values(state.groups).forEach((other) => {
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
    state.badgeEls[key] = badge;
    group.badgeSize = { width: badge.offsetWidth, height: badge.offsetHeight };
  });
}

export function rebuildGroupsKeepingExpanded() {
  const wasExpanded = new Set();
  Object.values(state.groups).forEach((group) => {
    if (group.expanded) group.indices.forEach((i) => wasExpanded.add(i));
  });
  destroyClusters();
  state.groups = buildGroups();
  Object.values(state.groups).forEach((group) => {
    if (
      group.indices.length > 1 &&
      group.indices.some((i) => wasExpanded.has(i))
    ) {
      group.expanded = true;
    }
  });
  createClusters();
}
