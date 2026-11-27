// Pure helpers for release.mjs / watch-release.mjs (kept side-effect free so node --test can cover them).

const major = (v) => String(v).trim().replace(/^v/, "").split(".")[0];

/** Returns a list of human-readable toolchain mismatches (empty = fine). */
export function toolchainProblems({ packageManager, pnpmVersion, nvmrc, nodeVersion }) {
  const problems = [];
  const pm = /^pnpm@(\d+)/.exec(packageManager ?? "");
  if (!pm) problems.push(`package.json packageManager "${packageManager}" is not pnpm@<version>`);
  else if (pm[1] !== major(pnpmVersion))
    problems.push(`pnpm major ${major(pnpmVersion)} locally, packageManager pins ${pm[1]}`);
  if (major(nvmrc) !== major(nodeVersion))
    problems.push(`node major ${major(nodeVersion)} locally, .nvmrc says ${major(nvmrc)}`);
  return problems;
}

/**
 * Classifies a workflow run from `gh run view --json jobs`.
 * "infra" = a job was cancelled/failed without ever running a step (runner never acquired).
 */
export function classifyRun(jobs) {
  if (!jobs?.length || jobs.some((j) => j.status !== "completed")) return "pending";
  if (jobs.every((j) => j.conclusion === "success")) return "success";
  const neverRan = (j) =>
    !j.steps?.length ||
    j.steps.every((s) => s.status !== "completed" || s.conclusion === "skipped");
  const bad = jobs.filter((j) => j.conclusion !== "success" && j.conclusion !== "skipped");
  return bad.length && bad.every(neverRan) ? "infra" : "failed";
}

/** Names of required assets missing from a `gh release view --json assets` list. */
export function missingAssets(version, assets) {
  const have = new Set((assets ?? []).map((a) => a.name));
  return [
    `ZibbyOS-${version}-arm64.zip`,
    `ZibbyOS-${version}-arm64.zip.sha256`,
    `ZibbyOS-${version}-arm64.dmg`,
  ].filter((n) => !have.has(n));
}
