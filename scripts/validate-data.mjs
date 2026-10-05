import { readFileSync } from "node:fs";

const data = JSON.parse(
  readFileSync(new URL("../monitors.json", import.meta.url), "utf8"),
);
const errors = [];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

const isPositive = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const isText = (v) => typeof v === "string" && v.trim() !== "";

function checkUnique(values, what) {
  const seen = new Set();
  values.forEach((value) => {
    check(!seen.has(value), `Duplicate ${what}: ${value}`);
    seen.add(value);
  });
}

check(
  /^\d{4}-\d{2}-\d{2}$/.test(data.pricesChecked ?? ""),
  "pricesChecked needs a date in YYYY-MM-DD form",
);

Object.entries(data.categories).forEach(([key, cat]) => {
  check(isText(cat.label), `Category ${key} needs a label`);
  check(isText(cat.group), `Category ${key} needs a group`);
  check(HEX_COLOR.test(cat.color), `Category ${key} needs a hex color`);
  check(
    HEX_COLOR.test(cat.colorLight),
    `Category ${key} needs a hex colorLight`,
  );
});

data.monitors.forEach((m) => {
  const where = `Monitor "${m.name}"`;
  check(isText(m.name), `A monitor is missing its name`);
  check(isText(m.shortName), `${where} needs a shortName`);
  check(isText(m.panel), `${where} needs a panel`);
  ["w", "h", "diag", "hz"].forEach((field) => {
    check(isPositive(m[field]), `${where} needs a positive ${field}`);
  });
  check(
    Number.isInteger(m.w) && Number.isInteger(m.h),
    `${where} needs whole pixel counts`,
  );
  check(m.cat in data.categories, `${where} uses unknown category ${m.cat}`);
  check(
    m.upcoming === undefined || typeof m.upcoming === "boolean",
    `${where} has an upcoming flag that is not true or false`,
  );
  ["price", "msrp"].forEach((field) => {
    check(
      m[field] === undefined || isPositive(m[field]),
      `${where} has a ${field} that is not a positive number`,
    );
  });
  check(
    m.msrp === undefined || m.price === undefined || m.price <= m.msrp,
    `${where} has a street price above its list price`,
  );
  check(
    m.year === undefined || (Number.isInteger(m.year) && m.year >= 2015),
    `${where} has an implausible year`,
  );
  check(
    m.url === undefined || /^https:\/\/\S+$/.test(m.url),
    `${where} has a url that is not an https link`,
  );
});

checkUnique(
  data.monitors.map((m) => slug(m.name ?? "")),
  "monitor id (the name in lowercase with punctuation removed)",
);
checkUnique(
  data.monitors.map((m) => m.shortName),
  "shortName",
);

const REFERENCE_FIELDS = {
  ratioLines: ["r"],
  mpCurves: ["w", "h"],
  ppiLines: ["ppi"],
  areaCurves: ["area"],
};
Object.entries(REFERENCE_FIELDS).forEach(([list, fields]) => {
  check(Array.isArray(data[list]), `${list} is missing`);
  (data[list] ?? []).forEach((entry) => {
    const where = `${list} entry "${entry.name}"`;
    check(isText(entry.name), `A ${list} entry is missing its name`);
    check(HEX_COLOR.test(entry.color), `${where} needs a hex color`);
    check(HEX_COLOR.test(entry.colorLight), `${where} needs a hex colorLight`);
    check(typeof entry.default === "boolean", `${where} needs a default flag`);
    fields.forEach((field) => {
      check(isPositive(entry[field]), `${where} needs a positive ${field}`);
    });
  });
  checkUnique(
    (data[list] ?? []).map((entry) => slug(entry.name ?? "")),
    `${list} name`,
  );
});

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`monitors.json is valid (${data.monitors.length} monitors).`);
