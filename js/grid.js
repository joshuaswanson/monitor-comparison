import { AXES } from "./axes.js";
import { chartArea, chartContainer, yLabelsCol } from "./dom.js";
import { xPos, yPos } from "./scale.js";
import { state } from "./state.js";
import { niceTicks } from "./util.js";

let gridLayer = null;

function tickCount(lengthPx, minSpacingPx, most) {
  return Math.max(2, Math.min(most, Math.floor(lengthPx / minSpacingPx)));
}

export function drawGrid() {
  if (gridLayer) gridLayer.remove();
  gridLayer = document.createElement("div");
  gridLayer.style.cssText =
    "position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;";
  chartArea.insertBefore(gridLayer, chartArea.firstChild);

  yLabelsCol.innerHTML = "";
  chartContainer.querySelectorAll(".axis-label-x").forEach((el) => el.remove());

  const yFmt = AXES[state.yAxisKey].format;
  const xFmt = AXES[state.xAxisKey].format;

  niceTicks(
    state.yRange.min,
    state.yRange.max,
    tickCount(state.chartHeight, 50, 7),
  ).forEach((v) => {
    const y = yPos(v);
    if (y < -5 || y > state.chartHeight + 5) return;
    const line = document.createElement("div");
    line.className = "grid-line-h";
    line.style.top = y + "px";
    gridLayer.appendChild(line);
    const lbl = document.createElement("div");
    lbl.className = "axis-label-y";
    lbl.style.top = state.areaOffsetTop + y + "px";
    lbl.textContent = yFmt(v);
    yLabelsCol.appendChild(lbl);
  });

  niceTicks(
    state.xRange.min,
    state.xRange.max,
    tickCount(state.chartWidth, 55, 8),
  ).forEach((v) => {
    const x = xPos(v);
    if (x < -5 || x > state.chartWidth + 5) return;
    const line = document.createElement("div");
    line.className = "grid-line-v";
    line.style.left = x + "px";
    gridLayer.appendChild(line);
    const lbl = document.createElement("div");
    lbl.className = "axis-label-x";
    lbl.style.left = state.areaOffsetLeft + x + "px";
    lbl.textContent = xFmt(v);
    chartContainer.appendChild(lbl);
  });
}
