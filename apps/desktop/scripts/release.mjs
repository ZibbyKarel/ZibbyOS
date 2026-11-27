#!/usr/bin/env node
// Cuts a ZibbyOS desktop release: bumps apps/desktop/package.json, commits only that
// file, tags `desktop-v<version>` and pushes main + the tag. The tag push triggers
// .github/workflows/desktop-release.yml, which builds the app on a macOS runner and
// publishes the GitHub Release the installed app's updater reads.
//
//   pnpm release:patch    # 0.1.0 → 0.1.1
//   pnpm release:minor    # 0.1.0 → 0.2.0
//   pnpm release:major    # 0.1.0 → 1.0.0
//   node apps/desktop/scripts/release.mjs 1.0.0   # explicit version
//
// Flags: --skip-preflight (no local build before tagging), --no-watch (don't wait for CI).
// Before anything is committed it builds the app locally (pnpm desktop:dist), so a broken
// build never leaves an orphan tag; after the push it watches CI (watch-release.mjs).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toolchainProblems } from "./release-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const pkgPath = path.join(repoRoot, "apps/desktop/package.json");
const pkgRel = path.relative(repoRoot, pkgPath);
const TAG_PREFIX = "desktop-v";

function git(args, opts = {}) {
  // With stdio: "inherit" execFileSync returns null (output went to the terminal).
  return (execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", ...opts }) ?? "").trim();
}

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function bump(current, kind) {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN))
    fail(`current version "${current}" is not x.y.z`);
  const [major, minor, patch] = parts;
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  if (kind === "patch") return `${major}.${minor}.${patch + 1}`;
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  fail(`unknown bump "${kind}" — use patch, minor, major or an explicit x.y.z`);
}

const args = process.argv.slice(2);
const skipPreflight = args.includes("--skip-preflight");
const noWatch = args.includes("--no-watch");
const bumpArg = args.find((a) => !a.startsWith("--"));

function preflight() {
  const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const problems = toolchainProblems({
    packageManager: rootPkg.packageManager,
    pnpmVersion: execFileSync("pnpm", ["--version"], { cwd: repoRoot, encoding: "utf8" }),
    nvmrc: readFileSync(path.join(repoRoot, ".nvmrc"), "utf8"),
    nodeVersion: process.versions.node,
  });
  if (problems.length) fail(`toolchain mismatch — ${problems.join("; ")}`);

  // Same env as .github/workflows/desktop-release.yml; the bump is not written yet.
  const env = {
    ...process.env,
    ZIBBY_BUILD_SOURCE_ROOT: "~/Workspace/ZibbyOS",
    CSC_IDENTITY_AUTO_DISCOVERY: "false",
  };
  try {
    execFileSync("pnpm", ["install", "--frozen-lockfile"], {
      cwd: repoRoot,
      stdio: "inherit",
      env,
    });
    execFileSync("pnpm", ["desktop:dist"], { cwd: repoRoot, stdio: "inherit", env });
  } catch {
    fail("preflight build failed — nothing was tagged");
  }
  const app = path.join(repoRoot, "apps/desktop/release/mac-arm64/ZibbyOS.app");
  if (!existsSync(app)) fail(`preflight build produced no ${app} — nothing was tagged`);
  const res = path.join(app, "Contents/Resources");
  const envFiles = readdirSync(res).filter((f) => f.startsWith(".env") && f !== ".env.example");
  if (envFiles.length)
    fail(`bundle contains env files (${envFiles.join(", ")}) — nothing was tagged`);
  console.log("release: preflight build OK");
}

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== "main") fail(`releases are cut from main (you are on ${branch})`);
if (git(["status", "--porcelain", "--", pkgRel])) fail(`${pkgRel} has uncommitted changes`);

git(["fetch", "origin", "main", "--tags"], { stdio: "inherit" });
const behind = git(["rev-list", "--count", "HEAD..origin/main"]);
if (behind !== "0") fail(`main is ${behind} commit(s) behind origin/main — pull first`);

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const next = bump(
  pkg.version,
  bumpArg ?? fail("missing bump — use pnpm release:patch | release:minor | release:major"),
);
const tag = `${TAG_PREFIX}${next}`;
if (git(["tag", "-l", tag])) fail(`tag ${tag} already exists`);

if (skipPreflight) {
  console.warn(
    "release: WARNING --skip-preflight: not building locally, a broken build will leave a tag behind",
  );
} else {
  preflight();
}

pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`ZibbyOS ${pkg.version} → tag ${tag}`);

// The pre-commit self-knowledge gate checks the vault note against the code.
execFileSync("pnpm", ["self-knowledge:generate"], { cwd: repoRoot, stdio: "inherit" });
// Pathspec commit: never sweeps up files other sessions have staged.
git(["commit", "-m", `release(desktop): ZibbyOS ${next}`, "--", pkgRel], { stdio: "inherit" });
git(["tag", "-a", tag, "-m", `ZibbyOS ${next}`]);
git(["push", "--atomic", "origin", "main", tag], { stdio: "inherit" });

console.log(
  `\nPushed ${tag}. The build runs at https://github.com/ZibbyKarel/ZibbyOS/actions/workflows/desktop-release.yml`,
);
if (noWatch) {
  console.log(`Not watching CI. Later: node apps/desktop/scripts/watch-release.mjs ${tag}`);
} else {
  execFileSync("node", [path.join(__dirname, "watch-release.mjs"), tag], { stdio: "inherit" });
}
console.log(
  "The installed ZibbyOS offers it within 24 hours (or now: ZibbyOS → Check for Updates…).",
);
