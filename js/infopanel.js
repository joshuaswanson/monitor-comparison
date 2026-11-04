import { AXES } from "./axes.js";
import { chartArea, tooltip, SVG_NS } from "./dom.js";
import { state, dotEls, labelEls } from "./state.js";
import { setThemedColor, formatUsd, makeKeyboardButton } from "./util.js";

let pinnedDotIndex = null;

const TOOLTIP_ICONS = {
  resolution: "M2 3h12v10H2zM2 8h12M8 3v10",
  pixels: "M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z",
  density: "M4 4h2v2H4zM10 4h2v2h-2zM4 10h2v2H4zM10 10h2v2h-2z",
  aspect: "M2 6V3.5h3.5M10.5 3.5H14V6M14 10v2.5h-3.5M5.5 12.5H2V10",
  diagonal: "M3 13 13 3M9 3h4v4M7 13H3V9",
  size: "M2 4v8M14 4v8M4 8h8M6 6 4 8l2 2M10 6l2 2-2 2",
  area: "M2.5 2.5h11v11h-11zM2.5 7.5l5-5M2.5 12.5l10-10M7.5 13.5l6-6",
  refresh: "M13 8a5 5 0 1 1-1.5-3.5M13 2.5v2.5h-2.5",
  panel: "M8 2 2 5l6 3 6-3zM2 8l6 3 6-3M2 11l6 3 6-3",
  price: "M2 2.5h5.5L14 9l-5 5-6.5-6.5zM5.2 5.2h.01",
};

function tooltipIcon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("tt-icon");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", TOOLTIP_ICONS[name]);
  svg.appendChild(path);
  return svg;
}

function tooltipPart(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function tooltipRow(icon, label, value) {
  const row = tooltipPart("div", "tt-row");
  row.append(
    tooltipIcon(icon),
    tooltipPart("span", "tt-label", label),
    tooltipPart("span", "tt-value", value),
  );
  return row;
}

let onHideMonitor = () => {};

function tooltipHeader(i) {
  const m = state.monitors[i];
  const cat = state.categories[m.cat];
  const header = tooltipPart("div", "tt-header");
  const shape = tooltipPart("div", "tt-shape");
  setThemedColor(shape, cat);
  shape.style.aspectRatio = String(m.ar);

  const titles = tooltipPart("div", "tt-titles");
  const sub = tooltipPart("div", "tt-sub");
  sub.appendChild(tooltipPart("span", "", cat.label));
  if (m.year != null) sub.appendChild(tooltipPart("span", "", String(m.year)));
  if (m.upcoming) sub.appendChild(tooltipPart("span", "tt-badge", "Upcoming"));
  titles.append(tooltipPart("div", "tt-name", m.name), sub);

  const shapeBox = tooltipPart("div", "tt-shape-box");
  shapeBox.appendChild(shape);

  const hide = tooltipPart("button", "tt-hide", "Hide");
  hide.type = "button";
  hide.addEventListener("click", () => onHideMonitor(i));

  header.append(shapeBox, titles, hide);
  return header;
}

function showTooltip(i) {
  const m = state.monitors[i];
  tooltip.style.display = "block";

  const rows = tooltipPart("div", "tt-rows");
  rows.append(
    tooltipRow("resolution", "Resolution", `${m.w} × ${m.h} px`),
    tooltipRow("pixels", AXES.mp.name, `${m.mp.toFixed(1)} MP`),
    tooltipRow("density", AXES.ppi.name, `${m.ppi.toFixed(0)} PPI`),
    tooltipRow("aspect", AXES.ar.name, `${m.ar.toFixed(2)}:1`),
    tooltipRow("diagonal", AXES.diag.name, `${m.diag} in`),
    tooltipRow(
      "size",
      "Width × height",
      `${m.wIn.toFixed(1)} × ${m.hIn.toFixed(1)} in`,
    ),
    tooltipRow("area", AXES.area.name, `${m.area.toFixed(0)} in²`),
    tooltipRow("refresh", AXES.hz.name, `${m.hz} Hz`),
    tooltipRow("panel", "Panel", m.panel),
  );
  if (m.price != null) {
    rows.append(tooltipRow("price", AXES.price.name, formatUsd(m.price)));
  }

  tooltip.replaceChildren(tooltipHeader(i), rows);
  tooltip.setAttribute("aria-label", m.name);
  dotEls[i].setAttribute("aria-expanded", "true");
  tooltip.focus({ preventScroll: true });

  const db = dotEls[i].getBoundingClientRect();
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  let tx = db.right + 12,
    ty = db.top - 20;
  if (tx + width > window.innerWidth) tx = db.left - 12 - width;
  ty = Math.max(10, Math.min(ty, window.innerHeight - height - 10));
  tooltip.style.left = tx + window.scrollX + "px";
  tooltip.style.top = ty + window.scrollY + "px";
}

export function unpinDot() {
  if (pinnedDotIndex === null) return;
  dotEls[pinnedDotIndex].classList.remove("pinned");
  dotEls[pinnedDotIndex].setAttribute("aria-expanded", "false");
  pinnedDotIndex = null;
  tooltip.style.display = "none";
}

export function createDots(onHide) {
  onHideMonitor = onHide;
  state.monitors.forEach((m, i) => {
    const cat = state.categories[m.cat];
    const dot = document.createElement("div");
    dot.className = "dot" + (m.upcoming ? " upcoming" : "");
    setThemedColor(dot, cat);
    makeKeyboardButton(
      dot,
      `${m.name}${m.upcoming ? " (upcoming)" : ""}, ${m.w} x ${m.h}, ${m.diag} inch, ${m.hz} Hz, ${m.panel}`,
    );
    dot.setAttribute("aria-haspopup", "dialog");
    dot.setAttribute("aria-expanded", "false");

    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasPinned = pinnedDotIndex === i;
      unpinDot();
      if (wasPinned) return;
      pinnedDotIndex = i;
      dot.classList.add("pinned");
      showTooltip(i);
    });

    chartArea.appendChild(dot);
    dotEls.push(dot);

    const label = document.createElement("div");
    label.className = "monitor-label";
    label.textContent = m.shortName;
    chartArea.appendChild(label);
    labelEls.push(label);
  });

  tooltip.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", unpinDot);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || pinnedDotIndex === null) return;
    const dot = dotEls[pinnedDotIndex];
    unpinDot();
    dot.focus();
  });
}
