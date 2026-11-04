import { AXES } from "./axes.js";

export const NUMERIC_FILTERS = ["diag", "ppi", "hz", "price"].map((key) => ({
  key,
  label: AXES[key].name,
  unit: AXES[key].unit,
}));

export const PANEL_FAMILIES = ["IPS", "VA", "OLED", "Mini-LED"];

export const filters = {
  ranges: Object.fromEntries(
    NUMERIC_FILTERS.map(({ key }) => [key, { min: null, max: null }]),
  ),
  panels: new Set(PANEL_FAMILIES),
};

function panelFamily(panel) {
  if (panel.includes("OLED")) return "OLED";
  if (panel.includes("Mini-LED")) return "Mini-LED";
  if (panel.includes("VA")) return "VA";
  return "IPS";
}

export function passesFilters(m) {
  if (!filters.panels.has(panelFamily(m.panel))) return false;
  return NUMERIC_FILTERS.every(({ key }) => {
    const { min, max } = filters.ranges[key];
    if (min === null && max === null) return true;
    const value = m[key];
    return (
      Number.isFinite(value) &&
      (min === null || value >= min) &&
      (max === null || value <= max)
    );
  });
}

export function filtersAreActive() {
  return (
    filters.panels.size < PANEL_FAMILIES.length ||
    NUMERIC_FILTERS.some(({ key }) => {
      const { min, max } = filters.ranges[key];
      return min !== null || max !== null;
    })
  );
}
