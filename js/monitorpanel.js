import { passesFilters } from "./filters.js";
import { state } from "./state.js";
import { categorySwatch, setTriState } from "./util.js";

function sortedCategories() {
  const grouped = {};
  state.monitors.forEach((m, i) => {
    if (!grouped[m.cat]) grouped[m.cat] = { indices: [] };
    grouped[m.cat].indices.push(i);
  });
  return Object.keys(state.categories)
    .filter((key) => grouped[key])
    .map((key) => ({
      key,
      indices: grouped[key].indices,
    }));
}

const checkboxEls = [];

const catCheckboxEls = {};

const monitorLabelEls = [];

let allMonitorsCb = null;

let onVisibilityChange = () => {};

function unreleasedTag() {
  const tag = document.createElement("span");
  tag.className = "unreleased-tag";
  tag.textContent = "(unreleased)";
  return tag;
}

function monitorCheckbox(i) {
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = state.visibleMonitors.has(i);
  cb.addEventListener("change", updateVisibility);
  checkboxEls[i] = cb;
  return cb;
}

export function buildMonitorPanel(onChange) {
  onVisibilityChange = onChange;
  const container = document.getElementById("monitorPanel");
  container.innerHTML = "";
  const panel = document.createElement("div");
  panel.className = "monitor-panel";

  const allLabel = document.createElement("label");
  allLabel.className = "monitor-list-category-title monitor-list-all";
  const allCb = document.createElement("input");
  allCb.type = "checkbox";
  allCb.addEventListener("change", () => {
    checkboxEls.forEach((cb) => (cb.checked = allCb.checked));
    updateVisibility();
  });
  allLabel.appendChild(allCb);
  allLabel.appendChild(document.createTextNode("Show all"));
  panel.appendChild(allLabel);
  allMonitorsCb = allCb;

  const list = document.createElement("div");
  list.className = "monitor-list open";

  sortedCategories().forEach(({ key: catKey, indices }) => {
    const cat = state.categories[catKey];

    if (indices.length === 1) {
      const i = indices[0];
      const label = document.createElement("label");
      label.className = "monitor-list-category-title";
      monitorLabelEls[i] = label;
      label.appendChild(monitorCheckbox(i));
      label.appendChild(categorySwatch("cat-dot", cat));
      label.appendChild(document.createTextNode(state.monitors[i].shortName));
      if (state.monitors[i].upcoming) label.appendChild(unreleasedTag());
      list.appendChild(label);
      return;
    }

    const section = document.createElement("div");
    section.className = "monitor-list-category";

    const title = document.createElement("label");
    title.className = "monitor-list-category-title";
    const catCb = document.createElement("input");
    catCb.type = "checkbox";
    catCb.addEventListener("change", () => {
      indices.forEach((i) => (checkboxEls[i].checked = catCb.checked));
      updateVisibility();
    });
    catCheckboxEls[catKey] = { cb: catCb, indices };
    title.appendChild(catCb);
    title.appendChild(categorySwatch("cat-dot", cat));
    title.appendChild(document.createTextNode(cat.label));
    section.appendChild(title);

    const items = document.createElement("div");
    items.className = "monitor-list-items";
    indices.forEach((i) => {
      const label = document.createElement("label");
      label.className = "monitor-checkbox-label";
      monitorLabelEls[i] = label;
      label.appendChild(monitorCheckbox(i));
      label.appendChild(document.createTextNode(state.monitors[i].shortName));
      if (state.monitors[i].upcoming) label.appendChild(unreleasedTag());
      items.appendChild(label);
    });

    section.appendChild(items);
    list.appendChild(section);
  });

  panel.appendChild(list);
  container.appendChild(panel);
  syncGroupCheckboxes();
}

function syncGroupCheckboxes() {
  Object.values(catCheckboxEls).forEach(({ cb, indices }) => {
    const checkedCount = indices.filter((i) => checkboxEls[i].checked).length;
    setTriState(cb, checkedCount, indices.length);
  });
  const shown = checkboxEls.filter((cb) => cb.checked).length;
  setTriState(allMonitorsCb, shown, state.monitors.length);
  document.getElementById("monitorStatus").textContent =
    `${shown} of ${state.monitors.length} shown`;
}

function updateVisibility() {
  state.visibleMonitors = new Set(
    state.monitors.map((_, i) => i).filter((i) => checkboxEls[i].checked),
  );
  syncGroupCheckboxes();
  onVisibilityChange();
}

export function hideMonitor(i) {
  checkboxEls[i].checked = false;
  updateVisibility();
}

export function markFilteredMonitors() {
  state.monitors.forEach((m, i) => {
    monitorLabelEls[i].classList.toggle("filtered-out", !passesFilters(m));
  });
}
