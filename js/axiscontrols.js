import { AXES, AXIS_GROUPS } from "./axes.js";
import { state } from "./state.js";

function buildAxisSelect(selectedKey) {
  const select = document.createElement("select");
  AXIS_GROUPS.forEach((group) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    group.keys.forEach((key) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = AXES[key].label;
      if (key === selectedKey) opt.selected = true;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });
  return select;
}

function buildAxisControl(text, selectedKey) {
  const group = document.createElement("label");
  group.className = "axis-control-group";
  const caption = document.createElement("span");
  caption.textContent = text;
  group.appendChild(caption);
  const select = buildAxisSelect(selectedKey);
  group.appendChild(select);
  document.getElementById("axisControls").appendChild(group);
  return select;
}

export function buildAxisControls(onSwitch) {
  document.getElementById("axisControls").innerHTML = "";
  const xSelect = buildAxisControl("X:", state.xAxisKey);
  const ySelect = buildAxisControl("Y:", state.yAxisKey);
  xSelect.addEventListener("change", () =>
    onSwitch(xSelect.value, state.yAxisKey),
  );
  ySelect.addEventListener("change", () =>
    onSwitch(state.xAxisKey, ySelect.value),
  );
}

export function updateAxisTitles() {
  document.getElementById("xAxisTitle").textContent =
    AXES[state.xAxisKey].label + " →";
  document.getElementById("yAxisTitle").textContent =
    AXES[state.yAxisKey].label + " →";
}
