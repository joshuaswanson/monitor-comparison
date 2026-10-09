import { chartArea, chartContainer } from "./dom.js";
import { state } from "./state.js";
import { niceRange } from "./util.js";

export function xPos(v) {
  return (
    ((v - state.xRange.min) / (state.xRange.max - state.xRange.min)) *
    state.chartWidth
  );
}

export function yPos(v) {
  return (
    state.chartHeight -
    ((v - state.yRange.min) / (state.yRange.max - state.yRange.min)) *
      state.chartHeight
  );
}

export function measureChart() {
  const rect = chartArea.getBoundingClientRect();
  state.chartWidth = rect.width;
  state.chartHeight = rect.height;
  const chartRect = chartContainer.getBoundingClientRect();
  state.areaOffsetLeft = rect.left - chartRect.left - chartContainer.clientLeft;
  state.areaOffsetTop = rect.top - chartRect.top;
}

function axisRange(key) {
  let values = [...state.plotted].map((i) => state.monitors[i][key]);
  if (values.length === 0) {
    values = state.monitors.map((m) => m[key]).filter(Number.isFinite);
  }
  if (values.length === 0) return { min: 0, max: 1 };
  return niceRange(values, 0.15);
}

export function targetRanges() {
  return { x: axisRange(state.xAxisKey), y: axisRange(state.yAxisKey) };
}
