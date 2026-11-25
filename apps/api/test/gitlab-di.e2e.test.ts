import type { Integration, Project } from "@zibby/contracts";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { ResolvedProjectService } from "../src/projects/resolved-project.service";
import { TaskOutputService } from "../src/tasks/task-output.service";
import { WorkflowRunnerService } from "../src/workflows/workflow-runner.service";

/**
 * The PR openers reach `ResolvedProjectService` through `@Optional()` injection. A
 * type-only import erases the DI token (`design:paramtypes` = `Object`), Nest then injects
 * `undefined` silently and every GitLab project falls back to `gh pr create`. This boots the
 * real module graph (compile only — no `onModuleInit`) and checks the dependency is there.
 */
describe("GitLab DI wiring (e2e)", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it("injects ResolvedProjectService into TaskOutputService and WorkflowRunnerService", () => {
    const resolved = moduleRef.get(ResolvedProjectService, { strict: false });
    expect(resolved).toBeInstanceOf(ResolvedProjectService);
    expect(moduleRef.get(TaskOutputService, { strict: false })["resolvedProjects"]).toBe(resolved);
    expect(moduleRef.get(WorkflowRunnerService, { strict: false })["resolvedProjects"]).toBe(
      resolved,
    );
  });

  it("gitlabOpt yields the GitLab option for a GitLab project", async () => {
    const resolved = moduleRef.get(ResolvedProjectService, { strict: false });
    const integration = {
      id: "gl",
      config: { kind: "gitlab", host: "gitlab.example.com" },
    } as unknown as Integration;
    const original = resolved.resolveIntegrations.bind(resolved);
    resolved.resolveIntegrations = async () => [integration];
    try {
      // The repo comes from the project's gitRemote — an account stores none.
      const project = {
        id: "p1",
        gitRemote: "git@gitlab.example.com:group/sub/project.git",
      } as unknown as Project;
      const expected = { gitlab: { host: "gitlab.example.com", repo: "group/sub/project" } };
      await expect(
        moduleRef.get(TaskOutputService, { strict: false })["gitlabOpt"](project),
      ).resolves.toEqual(expected);
      await expect(
        moduleRef.get(WorkflowRunnerService, { strict: false })["gitlabOpt"](project),
      ).resolves.toEqual(expected);
    } finally {
      resolved.resolveIntegrations = original;
    }
  });
});
