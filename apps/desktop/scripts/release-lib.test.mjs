import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyRun, missingAssets, toolchainProblems } from "./release-lib.mjs";

const job = (status, conclusion, steps) => ({ status, conclusion, steps });
const step = (conclusion, status = "completed") => ({ status, conclusion });

test("classifyRun", () => {
  assert.equal(classifyRun([]), "pending");
  assert.equal(classifyRun([job("in_progress", "", [])]), "pending");
  assert.equal(classifyRun([job("completed", "success", [step("success")])]), "success");
  // runner never acquired: cancelled, no steps
  assert.equal(classifyRun([job("completed", "cancelled", [])]), "infra");
  assert.equal(classifyRun([job("completed", "failure", [step("skipped")])]), "infra");
  // real step failure
  assert.equal(
    classifyRun([job("completed", "failure", [step("success"), step("failure")])]),
    "failed",
  );
});

test("toolchainProblems", () => {
  const ok = {
    packageManager: "pnpm@11.18.0+sha512.x",
    pnpmVersion: "11.2.0",
    nvmrc: "22.13\n",
    nodeVersion: "v22.13.1",
  };
  assert.deepEqual(toolchainProblems(ok), []);
  assert.equal(toolchainProblems({ ...ok, pnpmVersion: "10.4.0" }).length, 1);
  assert.equal(toolchainProblems({ ...ok, nodeVersion: "v20.1.0" }).length, 1);
  assert.equal(toolchainProblems({ ...ok, packageManager: undefined }).length, 1);
});

test("missingAssets", () => {
  const names = [
    "ZibbyOS-1.0.0-arm64.zip",
    "ZibbyOS-1.0.0-arm64.zip.sha256",
    "ZibbyOS-1.0.0-arm64.dmg",
  ];
  assert.deepEqual(
    missingAssets(
      "1.0.0",
      names.map((name) => ({ name })),
    ),
    [],
  );
  assert.deepEqual(missingAssets("1.0.0", [{ name: names[0] }]), names.slice(1));
});
