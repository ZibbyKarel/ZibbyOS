// usage: node merge-i18n.mjs <slug>  — deep-merges pending/<slug>.{cs,en}.json into the catalogs, then deletes the pending files
import fs from "node:fs";
const slug = process.argv[2];
const dir = "apps/web/i18n/messages";
for (const loc of ["cs", "en"]) {
  const pend = `${dir}/pending/${slug}.${loc}.json`;
  if (!fs.existsSync(pend)) { console.log("missing", pend); continue; }
  const cat = JSON.parse(fs.readFileSync(`${dir}/${loc}.json`, "utf8"));
  const add = JSON.parse(fs.readFileSync(pend, "utf8"));
  const conflicts = [];
  const merge = (t, s, p) => { for (const [k, v] of Object.entries(s)) {
    if (v && typeof v === "object" && !Array.isArray(v)) { if (t[k] === undefined) t[k] = {}; if (typeof t[k] !== "object") { conflicts.push(p + k); continue; } merge(t[k], v, p + k + "."); }
    else { if (t[k] !== undefined && t[k] !== v) conflicts.push(`${p}${k}: "${t[k]}" -> "${v}"`); t[k] = v; } } };
  merge(cat, add, "");
  fs.writeFileSync(`${dir}/${loc}.json`, JSON.stringify(cat, null, 2) + "\n");
  fs.unlinkSync(pend);
  console.log(loc, "merged", conflicts.length ? "OVERWROTE: " + conflicts.join("; ") : "no conflicts");
}
