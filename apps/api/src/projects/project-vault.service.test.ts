import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Project } from "@zibby/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VaultService } from "../memory/vault.service";
import { ProjectVaultService } from "./project-vault.service";

const project = { id: "acme", name: "Acme" } as Project;

describe("ProjectVaultService (folder layout)", () => {
  let dir: string;
  let svc: ProjectVaultService;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "project-vault-"));
    svc = new ProjectVaultService(dir);
  });
  afterEach(() => fs.rm(dir, { recursive: true, force: true }));

  it("writes projects/<id>/<id>.md and migrates a legacy flat note", async () => {
    await fs.mkdir(path.join(dir, "projects"), { recursive: true });
    await fs.writeFile(path.join(dir, "projects", "acme.md"), "old");
    await svc.write(project);
    expect(await fs.readFile(path.join(dir, "projects", "acme", "acme.md"), "utf8")).toContain(
      "# Acme",
    );
    await expect(fs.stat(path.join(dir, "projects", "acme.md"))).rejects.toThrow();
  });

  it("remove deletes the note but keeps TODO.md", async () => {
    await svc.write(project);
    await fs.writeFile(path.join(dir, "projects", "acme", "TODO.md"), "1. [ ] x");
    await svc.remove("acme");
    await expect(fs.stat(path.join(dir, "projects", "acme", "acme.md"))).rejects.toThrow();
    await expect(fs.stat(path.join(dir, "projects", "acme", "TODO.md"))).resolves.toBeTruthy();
  });

  it("VaultService resolves folder + legacy notes and ignores index.md/TODO.md", async () => {
    await svc.write(project);
    await fs.writeFile(path.join(dir, "projects", "acme", "TODO.md"), "1. [ ] x");
    await fs.writeFile(path.join(dir, "projects", "index.md"), "# projects");
    await fs.writeFile(path.join(dir, "projects", "legacy.md"), "# Legacy");
    const vault = new VaultService(dir);
    expect((await vault.note("acme")).path).toBe(path.join("projects", "acme", "acme.md"));
    expect((await vault.note("legacy")).path).toBe(path.join("projects", "legacy.md"));
    await expect(vault.note("TODO")).rejects.toThrow();
    await expect(vault.note("index")).rejects.toThrow();
  });
});
