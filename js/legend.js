import { legendContainer } from "./dom.js";
import { state } from "./state.js";
import { categorySwatch } from "./util.js";

function legendGroups() {
  const catsByGroup = new Map();
  Object.entries(state.categories).forEach(([key, cat]) => {
    if (!catsByGroup.has(cat.group)) catsByGroup.set(cat.group, []);
    catsByGroup.get(cat.group).push(key);
  });
  return [...catsByGroup].map(([label, cats]) => ({ label, cats }));
}

export function buildLegend() {
  legendContainer.innerHTML = "";
  const present = new Set(state.monitors.map((m) => m.cat));
  legendGroups().forEach((group) => {
    const cats = group.cats.filter((c) => present.has(c));
    if (cats.length === 0) return;
    const section = document.createElement("div");
    section.className = "legend-group";
    const heading = document.createElement("div");
    heading.className = "legend-group-heading";
    heading.textContent = group.label;
    section.appendChild(heading);
    cats.forEach((key) => {
      const cat = state.categories[key];
      const item = document.createElement("div");
      item.className = "legend-item";
      item.appendChild(categorySwatch("legend-dot", cat));
      item.appendChild(document.createTextNode(cat.label));
      section.appendChild(item);
    });
    legendContainer.appendChild(section);
  });
}
