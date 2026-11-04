export const DEFAULT_X_AXIS = "area";

export const DEFAULT_Y_AXIS = "ppi";

function axis(name, unit, format) {
  return { name, unit, label: unit ? `${name} (${unit})` : name, format };
}

export const AXES = {
  w: axis("Horizontal resolution", "px", (v) => v.toFixed(0)),
  h: axis("Vertical resolution", "px", (v) => v.toFixed(0)),
  ppi: axis("Pixel density", "PPI", (v) => v.toFixed(0)),
  ar: axis("Aspect ratio", null, (v) => v.toFixed(2)),
  diag: axis("Diagonal", "in", (v) => v.toFixed(1)),
  mp: axis("Total pixels", "MP", (v) => v.toFixed(1)),
  area: axis("Screen area", "in²", (v) => v.toFixed(0)),
  wIn: axis("Width", "in", (v) => v.toFixed(1)),
  hIn: axis("Height", "in", (v) => v.toFixed(1)),
  hz: axis("Refresh rate", "Hz", (v) => v.toFixed(0)),
  price: axis("List price", "USD", (v) => "$" + v.toFixed(0)),
};

export const AXIS_GROUPS = [
  { label: "Physical size", keys: ["wIn", "hIn", "diag", "area"] },
  { label: "Resolution", keys: ["w", "h", "mp"] },
  { label: "Price", keys: ["price"] },
  { label: "Other", keys: ["ppi", "ar", "hz"] },
];
