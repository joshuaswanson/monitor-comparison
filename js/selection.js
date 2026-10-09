import { chartNote } from "./dom.js";
import { passesFilters } from "./filters.js";
import { state, dotEls, labelEls } from "./state.js";
import { plural } from "./util.js";

export function refreshPlotted() {
  const matching = [...state.visibleMonitors].filter((i) =>
    passesFilters(state.monitors[i]),
  );
  state.plotted = new Set(
    matching.filter(
      (i) =>
        Number.isFinite(state.monitors[i][state.xAxisKey]) &&
        Number.isFinite(state.monitors[i][state.yAxisKey]),
    ),
  );
  const missing = matching.length - state.plotted.size;
  chartNote.textContent =
    missing > 0
      ? `${missing} selected ${plural(missing, "monitor has", "monitors have")} no value for these axes and ${plural(missing, "is", "are")} left off the chart.`
      : "";
}

export function applyPlottedDisplay() {
  state.monitors.forEach((_, i) => {
    const show = state.plotted.has(i);
    dotEls[i].style.display = show ? "" : "none";
    labelEls[i].style.display = show ? "" : "none";
  });
}
