import { DEFAULT_X_AXIS, DEFAULT_Y_AXIS, AXES } from "./axes.js";
import { NUMERIC_FILTERS, PANEL_FAMILIES, filters } from "./filters.js";
import { state } from "./state.js";

const LIST_SEPARATOR = ".";

export function readUrlState() {
  const params = new URLSearchParams(location.hash.slice(1));
  const list = (key) =>
    (params.get(key) || "").split(LIST_SEPARATOR).filter(Boolean);

  if (AXES[params.get("x")]) state.xAxisKey = params.get("x");
  if (AXES[params.get("y")]) state.yAxisKey = params.get("y");

  const show = new Set(list("show"));
  const hide = new Set(list("hide"));
  state.monitors.forEach((m, i) => {
    const visible = (!m.upcoming || show.has(m.id)) && !hide.has(m.id);
    if (visible) state.visibleMonitors.add(i);
  });

  NUMERIC_FILTERS.forEach(({ key }) => {
    ["min", "max"].forEach((bound) => {
      const value = parseFloat(params.get(key + bound));
      if (Number.isFinite(value)) filters.ranges[key][bound] = value;
    });
  });
  if (params.has("panel")) {
    filters.panels = new Set(
      list("panel").filter((family) => PANEL_FAMILIES.includes(family)),
    );
  }

  const refOn = new Set(list("refon"));
  const refOff = new Set(list("refoff"));
  state.refLines.forEach((ref) => {
    ref.enabled = (ref.enabled || refOn.has(ref.id)) && !refOff.has(ref.id);
  });
}

export function writeUrlState() {
  const params = new URLSearchParams();
  const setList = (key, ids) => {
    if (ids.length > 0) params.set(key, ids.join(LIST_SEPARATOR));
  };

  if (state.xAxisKey !== DEFAULT_X_AXIS) params.set("x", state.xAxisKey);
  if (state.yAxisKey !== DEFAULT_Y_AXIS) params.set("y", state.yAxisKey);

  const shownByDefault = (m) => !m.upcoming;
  const ids = (predicate) =>
    state.monitors.filter((m, i) => predicate(m, i)).map((m) => m.id);
  setList(
    "show",
    ids((m, i) => state.visibleMonitors.has(i) && !shownByDefault(m)),
  );
  setList(
    "hide",
    ids((m, i) => !state.visibleMonitors.has(i) && shownByDefault(m)),
  );

  NUMERIC_FILTERS.forEach(({ key }) => {
    ["min", "max"].forEach((bound) => {
      const value = filters.ranges[key][bound];
      if (value !== null) params.set(key + bound, value);
    });
  });
  if (filters.panels.size < PANEL_FAMILIES.length) {
    params.set("panel", [...filters.panels].join(LIST_SEPARATOR));
  }

  const refIds = (predicate) =>
    state.refLines.filter(predicate).map((r) => r.id);
  setList(
    "refon",
    refIds((r) => r.enabled && !r.data.default),
  );
  setList(
    "refoff",
    refIds((r) => !r.enabled && r.data.default),
  );

  const hash = params.toString();
  history.replaceState(
    null,
    "",
    hash ? "#" + hash : location.pathname + location.search,
  );
}
