import { DEFAULT_X_AXIS, DEFAULT_Y_AXIS } from "./axes.js";

export const state = {
  monitors: [],
  categories: {},
  refLines: [],
  groups: {},
  badgeEls: {},
  visibleMonitors: new Set(),
  plotted: new Set(),
  xAxisKey: DEFAULT_X_AXIS,
  yAxisKey: DEFAULT_Y_AXIS,
  xRange: null,
  yRange: null,
  chartWidth: 0,
  chartHeight: 0,
  areaOffsetTop: 0,
  areaOffsetLeft: 0,
};

export const dotEls = [];
export const labelEls = [];
export const labelWidths = [];
