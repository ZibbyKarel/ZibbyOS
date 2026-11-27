#!/usr/bin/env node
// Watches the desktop-release workflow for a pushed tag, reruns it when GitHub never
// acquired a macOS runner (up to 3 attempts), and verifies the published release.
//   node apps/desktop/scripts/watch-release.mjs desktop-v1.2.3
import { execFileSync } from "node:child_process";
import { classifyRun, missingAssets } from "./release-lib.mjs";

const MAX_ATTEMPTS = 3;
const WORKFLOW = "desktop-release.yml";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const gh = (args, opts = {}) => execFileSync("gh", args, { encoding: "utf8", ...opts }).trim();
const ghJson = (args) => JSON.parse(gh(args));

function die(msg) {
  console.error(`watch-release: ${msg}`);
  process.exit(1);
}

async function findRun(tag) {
  for (let i = 0; i < 24; i++) {
    const [run] = ghJson([
      "run",
      "list",
      "--workflow",
      WORKFLOW,
      "--branch",
      tag,
      "--json",
      "databaseId,status,conclusion,url",
      "--limit",
      "1",
    ]);
    if (run) return run;
    await sleep(5000);
  }
  return die(`no ${WORKFLOW} run appeared for ${tag} within 2 minutes`);
}

async function waitDone(id) {
  for (;;) {
    const run = ghJson(["run", "view", String(id), "--json", "status,conclusion"]);
    if (run.status === "completed") return;
    await sleep(30_000);
  }
}

const tag = process.argv[2];
if (!tag?.startsWith("desktop-v")) die("usage: watch-release.mjs desktop-v<x.y.z>");
const version = tag.slice("desktop-v".length);

let run = await findRun(tag);
for (let attempt = 1; ; attempt++) {
  console.log(`Watching run ${run.url} (attempt ${attempt}/${MAX_ATTEMPTS})`);
  await waitDone(run.databaseId);
  const { jobs } = ghJson(["run", "view", String(run.databaseId), "--json", "jobs"]);
  const verdict = classifyRun(jobs);
  if (verdict === "success") break;
  if (verdict === "infra" && attempt < MAX_ATTEMPTS) {
    console.log("No runner was acquired (GitHub capacity) — rerunning the same tag.");
    gh(["run", "rerun", String(run.databaseId)]);
    await sleep(10_000);
    continue;
  }
  if (verdict === "infra") die(`runner never acquired after ${MAX_ATTEMPTS} attempts: ${run.url}`);
  try {
    console.error(
      gh(["run", "view", String(run.databaseId), "--log-failed"])
        .split("\n")
        .slice(-60)
        .join("\n"),
    );
  } catch {
    // logs may be unavailable
  }
  die(`build failed: ${run.url}`);
}

const rel = ghJson(["release", "view", tag, "--json", "isDraft,assets"]);
const missing = missingAssets(version, rel.assets);
if (rel.isDraft || missing.length)
  die(
    `release ${tag} is not complete (draft=${rel.isDraft}, missing: ${missing.join(", ") || "none"})`,
  );
console.log(`Release ${tag} is live — the app will offer it`);
