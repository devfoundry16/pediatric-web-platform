// Fails when the dictionaries disagree: a key present in one language only,
// or a translation whose {placeholders} differ from the English (a dropped
// {count} would render literally or lose the number).
//
//   node scripts/check-i18n.mjs
import { readFileSync } from "node:fs";

const dir = new URL("../lib/i18n/dictionaries/", import.meta.url);
const load = (lang) => JSON.parse(readFileSync(new URL(`${lang}.json`, dir), "utf8"));

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === "object"
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]]
  );
}

const placeholders = (value) =>
  typeof value === "string" ? [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",") : "";

const reference = new Map(flatten(load("en")));
const problems = [];

for (const lang of ["ar"]) {
  const other = new Map(flatten(load(lang)));
  for (const key of reference.keys()) {
    if (!other.has(key)) problems.push(`${lang}: missing ${key}`);
  }
  for (const [key, value] of other) {
    if (!reference.has(key)) {
      problems.push(`${lang}: ${key} is not in en`);
    } else if (placeholders(value) !== placeholders(reference.get(key))) {
      problems.push(`${lang}: ${key} has {${placeholders(value)}}, en has {${placeholders(reference.get(key))}}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`i18n dictionaries disagree (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`i18n dictionaries agree (${reference.size} keys).`);
