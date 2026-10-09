import { buildAxisControls, updateAxisTitles } from "./axiscontrols.js";
import { chartArea } from "./dom.js";
import { buildFilterPanel } from "./filterpanel.js";
import { createDots } from "./infopanel.js";
import { buildLegend } from "./legend.js";
import {
  buildMonitorPanel,
  hideMonitor,
  markFilteredMonitors,
} from "./monitorpanel.js";
import { REF_KINDS, createRefLines, measureLabelWidths } from "./reflines.js";
import { buildRefLinesPanel } from "./reflinespanel.js";
import {
  onSelectionChange,
  switchAxes,
  onRefLineToggle,
  relayout,
} from "./render.js";
import { refreshPlotted, applyPlottedDisplay } from "./selection.js";
import { state } from "./state.js";
import "./theme.js";
import { readUrlState, writeUrlState } from "./urlstate.js";
import { slug } from "./util.js";

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

  state.monitors = data.monitors;
  state.categories = data.categories;
  state.monitors.forEach(addDerivedProperties);
  state.refLines = REF_KINDS.flatMap((kind) =>
    data[kind.source].map((entry) => ({
      kind,
      data: entry,
      id: kind.id + "-" + slug(entry.name),
      enabled: Boolean(entry.default),
    })),
  );

  readUrlState();
  updateAxisTitles();

  refreshPlotted();
  buildAxisControls(switchAxes);
  buildMonitorPanel(onSelectionChange);
  buildFilterPanel(onSelectionChange);
  markFilteredMonitors();
  buildRefLinesPanel(onRefLineToggle);
  buildLegend();
  createRefLines();
  createDots(hideMonitor);

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
    if (state.monitors.length > 0) relayout();
  }, 150);
});

// writeUrlState uses replaceState, which does not fire hashchange, so this
// only runs when the address bar or a link changes the hash.
window.addEventListener("hashchange", () => location.reload());
