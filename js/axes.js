export const DEFAULT_X_AXIS = "area";

export const DEFAULT_Y_AXIS = "ppi";

export const AXES = {
  w: { label: "Horizontal pixels", format: (v) => v.toFixed(0) },
  h: { label: "Vertical pixels", format: (v) => v.toFixed(0) },
  ppi: { label: "PPI", format: (v) => v.toFixed(0) },
  ar: { label: "Aspect ratio", format: (v) => v.toFixed(2) },
  diag: { label: "Diagonal (in)", format: (v) => v.toFixed(1) },
  mp: { label: "Megapixels", format: (v) => v.toFixed(1) },
  area: { label: "Screen area (in²)", format: (v) => v.toFixed(0) },
  wIn: { label: "Width (in)", format: (v) => v.toFixed(1) },
  hIn: { label: "Height (in)", format: (v) => v.toFixed(1) },
  hz: { label: "Refresh rate (Hz)", format: (v) => v.toFixed(0) },
  price: { label: "List price (USD)", format: (v) => "$" + v.toFixed(0) },
};

export const AXIS_GROUPS = [
  { label: "Physical size", keys: ["wIn", "hIn", "diag", "area"] },
  { label: "Resolution", keys: ["w", "h", "mp"] },
  { label: "Price", keys: ["price"] },
  { label: "Other", keys: ["ppi", "ar", "hz"] },
];
