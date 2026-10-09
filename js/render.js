import { updateAxisTitles } from "./axiscontrols.js";
import {
  buildGroups,
  destroyClusters,
  createClusters,
  rebuildGroupsKeepingExpanded,
} from "./clusters.js";
import { updateFilterSummary } from "./filterpanel.js";
import { drawGrid } from "./grid.js";
import { unpinDot } from "./infopanel.js";
import { positionDots } from "./layout.js";
import { markFilteredMonitors } from "./monitorpanel.js";
import { updateRefLines, updateLabelMargin } from "./reflines.js";
import { updateRefLinesAvailability } from "./reflinespanel.js";
import { measureChart, targetRanges } from "./scale.js";
import { refreshPlotted, applyPlottedDisplay } from "./selection.js";
import { state } from "./state.js";
import { writeUrlState } from "./urlstate.js";

export function onSelectionChange() {
  refreshPlotted();
  updateFilterSummary();
  markFilteredMonitors();
  rebuildGroupsKeepingExpanded();
  rerender();
  writeUrlState();
}

export function switchAxes(newX, newY) {
  state.xAxisKey = newX;
  state.yAxisKey = newY;
  updateAxisTitles();
  updateRefLinesAvailability();
  refreshPlotted();
  updateLabelMargin();
  destroyClusters();
  state.groups = buildGroups();
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

  const startX = { ...state.xRange };
  const startY = { ...state.yRange };
  const startTime = performance.now();

  if (animationId) cancelAnimationFrame(animationId);

  function tick(now) {
    const t = Math.min(1, (now - startTime) / ANIM_DURATION);
    const e = 1 - Math.pow(1 - t, 3);

    state.xRange = {
      min: startX.min + (target.x.min - startX.min) * e,
      max: startX.max + (target.x.max - startX.max) * e,
    };
    state.yRange = {
      min: startY.min + (target.y.min - startY.min) * e,
      max: startY.max + (target.y.max - startY.max) * e,
    };

    drawFrame();
    animationId = t < 1 ? requestAnimationFrame(tick) : null;
  }

  animationId = requestAnimationFrame(tick);
}

export function onRefLineToggle() {
  relayout();
  writeUrlState();
}

export function relayout() {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  updateLabelMargin();
  rebuildGroupsKeepingExpanded();
  const target = targetRanges();
  state.xRange = target.x;
  state.yRange = target.y;
  drawFrame();
}
