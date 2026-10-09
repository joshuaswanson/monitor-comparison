import {
  NUMERIC_FILTERS,
  PANEL_FAMILIES,
  filters,
  passesFilters,
  filtersAreActive,
} from "./filters.js";
import { state } from "./state.js";
import { plural } from "./util.js";

const filterStatus = document.getElementById("filterStatus");
let filterReset = null;

let onFilterChange = () => {};

export function updateFilterSummary() {
  const selected = [...state.visibleMonitors];
  const matching = selected.filter((i) => passesFilters(state.monitors[i]));
  filterStatus.textContent = filtersAreActive()
    ? `${matching.length} of ${selected.length} selected ${plural(selected.length, "monitor matches", "monitors match")}`
    : "No filters set";
  filterReset.disabled = !filtersAreActive();
}

function filterBound(key, bound, labelText, placeholder) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.inputMode = "decimal";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", labelText);
  if (filters.ranges[key][bound] !== null)
    input.value = filters.ranges[key][bound];
  input.addEventListener("change", () => {
    const value = parseFloat(input.value);
    filters.ranges[key][bound] = Number.isFinite(value) ? value : null;
    onFilterChange();
  });
  return input;
}

function filterRange({ key, label, unit }) {
  const values = state.monitors.map((m) => m[key]).filter(Number.isFinite);
  const row = document.createElement("div");
  row.className = "filter-range";
  const name = document.createElement("span");
  name.className = "filter-name";
  name.textContent = label;
  const dash = document.createElement("span");
  dash.className = "filter-to";
  dash.textContent = "to";
  const unitEl = document.createElement("span");
  unitEl.className = "filter-unit";
  unitEl.textContent = unit;
  row.append(
    name,
    filterBound(
      key,
      "min",
      `Minimum ${label}, ${unit}`,
      Math.floor(Math.min(...values)),
    ),
    dash,
    filterBound(
      key,
      "max",
      `Maximum ${label}, ${unit}`,
      Math.ceil(Math.max(...values)),
    ),
    unitEl,
  );
  return row;
}

function panelChip(family) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "filter-chip";
  chip.textContent = family;
  chip.setAttribute("aria-pressed", String(filters.panels.has(family)));
  chip.addEventListener("click", () => {
    if (filters.panels.has(family)) filters.panels.delete(family);
    else filters.panels.add(family);
    chip.setAttribute("aria-pressed", String(filters.panels.has(family)));
    onFilterChange();
  });
  return chip;
}

export function buildFilterPanel(onChange) {
  onFilterChange = onChange;
  const container = document.getElementById("filterPanel");
  container.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "filter-panel";

  filterReset = document.createElement("button");
  filterReset.type = "button";
  filterReset.className = "filter-reset";
  filterReset.textContent = "Reset";
  filterReset.addEventListener("click", () => {
    NUMERIC_FILTERS.forEach(({ key }) => {
      filters.ranges[key] = { min: null, max: null };
    });
    filters.panels = new Set(PANEL_FAMILIES);
    buildFilterPanel(onFilterChange);
    onFilterChange();
  });
  const ranges = document.createElement("div");
  ranges.className = "filter-ranges";
  ranges.append(...NUMERIC_FILTERS.map(filterRange));

  const panels = document.createElement("div");
  panels.className = "filter-range filter-panels";
  const panelsName = document.createElement("span");
  panelsName.className = "filter-name";
  panelsName.textContent = "Panel";
  panels.append(panelsName, ...PANEL_FAMILIES.map(panelChip), filterReset);

  panel.append(ranges, panels);
  container.appendChild(panel);
  updateFilterSummary();
}
