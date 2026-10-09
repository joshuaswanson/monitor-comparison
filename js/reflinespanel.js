import { REF_KINDS } from "./reflines.js";
import { state } from "./state.js";
import { setThemedColor, setTriState } from "./util.js";

const kindSections = [];

function updateRefLinesStatus() {
  const enabled = state.refLines.filter((ref) => ref.enabled).length;
  document.getElementById("refLinesStatus").textContent =
    `${enabled} of ${state.refLines.length} on`;
}

export function updateRefLinesAvailability() {
  kindSections.forEach(({ section, entries }) => {
    const drawable = entries.some((ref) => ref.kind.geometry(ref.data));
    section.classList.toggle("unavailable", !drawable);
  });
}

export function buildRefLinesPanel(onToggle) {
  const onChange = () => {
    updateRefLinesStatus();
    onToggle();
  };
  kindSections.length = 0;
  const container = document.getElementById("refLinesPanel");
  container.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "ref-lines-panel";

  REF_KINDS.forEach((kind) => {
    const entries = state.refLines.filter((ref) => ref.kind === kind);
    const enabledCount = () => entries.filter((ref) => ref.enabled).length;

    const section = document.createElement("div");
    section.className = "ref-lines-section";

    const headingEl = document.createElement("div");
    headingEl.className = "ref-lines-heading";

    const headingText = document.createElement("span");
    headingText.textContent = kind.heading;
    headingEl.appendChild(headingText);

    const allCb = document.createElement("input");
    allCb.type = "checkbox";
    allCb.setAttribute("aria-label", `All ${kind.heading} reference lines`);
    setTriState(allCb, enabledCount(), entries.length);
    headingEl.appendChild(allCb);
    const allText = document.createElement("span");
    allText.className = "ref-lines-all-label";
    allText.textContent = "all";
    headingEl.appendChild(allText);

    section.appendChild(headingEl);

    const items = document.createElement("div");
    items.className = "ref-lines-items";

    const cbs = entries.map((ref) => {
      const label = document.createElement("label");
      label.className = "monitor-checkbox-label";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = ref.enabled;
      cb.addEventListener("change", () => {
        ref.enabled = cb.checked;
        setTriState(allCb, enabledCount(), entries.length);
        onChange();
      });
      label.appendChild(cb);
      const dot = document.createElement("div");
      dot.className = "cat-dot";
      setThemedColor(dot, ref.data);
      dot.style.background = "var(--c)";
      label.appendChild(dot);
      label.appendChild(document.createTextNode(ref.data.name));
      items.appendChild(label);
      return cb;
    });

    allCb.addEventListener("change", () => {
      entries.forEach((ref, i) => {
        ref.enabled = allCb.checked;
        cbs[i].checked = allCb.checked;
      });
      onChange();
    });

    section.appendChild(items);

    const note = document.createElement("div");
    note.className = "ref-lines-note";
    note.textContent = "Not drawn on these axes";
    section.appendChild(note);

    panel.appendChild(section);
    kindSections.push({ section, entries });
  });

  container.appendChild(panel);
  updateRefLinesStatus();
  updateRefLinesAvailability();
}
