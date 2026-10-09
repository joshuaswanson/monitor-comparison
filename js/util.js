export function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function niceRange(values, padding) {
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const rng = mx - mn || 1;
  return { min: Math.max(0, mn - rng * padding), max: mx + rng * padding };
}

export function niceTicks(min, max, count) {
  const rough = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].find((c) => c * mag >= rough) * mag;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    ticks.push(parseFloat(v.toPrecision(10)));
  }
  return ticks;
}

export function plural(count, one, many) {
  return count === 1 ? one : many;
}

export function rectsOverlap(a, b) {
  return (
    a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
  );
}

export function rectAround(x, y, halfW, halfH) {
  return {
    left: x - halfW,
    right: x + halfW,
    top: y - halfH,
    bottom: y + halfH,
  };
}

export function setThemedColor(el, entry) {
  el.classList.add("themed");
  el.style.setProperty("--color-dark", entry.color);
  el.style.setProperty("--color-light", entry.colorLight);
}

export function categorySwatch(className, cat) {
  const swatch = document.createElement("div");
  swatch.className = className + (cat.shape === "diamond" ? " diamond" : "");
  setThemedColor(swatch, cat);
  swatch.style.background = "var(--c)";
  return swatch;
}

export function formatUsd(amount) {
  return "$" + amount.toLocaleString("en-US");
}

export function makeKeyboardButton(el, ariaLabel) {
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", ariaLabel);
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    el.click();
  });
}

export function setTriState(cb, checkedCount, total) {
  cb.checked = checkedCount > 0;
  cb.indeterminate = checkedCount > 0 && checkedCount < total;
}
