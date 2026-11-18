import type { CiJob, CiState, CiWorkflowRun, ProjectCi } from "@zibby/contracts";
import type { GitlabClient } from "../git-host/gitlab-client";
import { rollup } from "./project-ci.service";

interface GlPipeline {
  id?: number;
  sha?: string;
  status?: string;
  web_url?: string;
}
interface GlJob {
  id?: number;
  name?: string;
  status?: string;
  web_url?: string;
}

/** GitLab pipeline/job status → one CI state. `manual` waits on a human: not red, not running. */
export function gitlabCiStateOf(status?: string): CiState {
  switch (status) {
    case "success":
      return "passing";
    case "failed":
      return "failing";
    case "running":
      return "running";
    case "canceled":
    case "canceling":
      return "cancelled";
    case "skipped":
    case "manual":
      return "skipped";
    case undefined:
      return "none";
    default:
      return "pending"; // created / waiting_for_resource / preparing / pending / scheduled
  }
}

/**
 * Base-branch CI of a GitLab project: default branch → its newest pipelines → every pipeline on
 * the newest commit (a retry is a new pipeline) with its jobs. GitLab has no step level, so jobs
 * carry `steps: []`. A failed read comes back as `state: "error"` (cached like the GitHub one).
 */
export async function readGitlabCi(
  client: GitlabClient,
  link: { host: string; repo: string },
  base: Pick<ProjectCi, "projectId" | "checkedAt">,
): Promise<ProjectCi> {
  const repoUrl = `https://${link.host}/${link.repo}`;
  const common = { ...base, provider: "gitlab" as const, repoUrl };
  try {
    const project = client.projectPath(link.repo);
    const { default_branch: branch } = await client.api<{ default_branch?: string }>(
      link.host,
      project,
    );
    if (!branch) return { ...common, state: "none", workflows: [] };
    const pipelines =
      (await client.api<GlPipeline[] | undefined>(
        link.host,
        `${project}/pipelines?ref=${encodeURIComponent(branch)}&order_by=id&sort=desc&per_page=20`,
      )) ?? [];
    const headSha = pipelines[0]?.sha;
    const onHead = pipelines.filter((p) => p.sha === headSha && p.id !== undefined);
    const workflows: CiWorkflowRun[] = await Promise.all(
      onHead.map(async (p) => {
        const jobs =
          (await client.api<GlJob[] | undefined>(
            link.host,
            `${project}/pipelines/${p.id}/jobs?per_page=100`,
          )) ?? [];
        return {
          id: p.id ?? 0,
          name: `Pipeline #${p.id}`,
          ...(p.web_url ? { url: p.web_url } : {}),
          state: gitlabCiStateOf(p.status),
          jobs: jobs.map(
            (j): CiJob => ({
              id: j.id ?? 0,
              name: j.name ?? "job",
              ...(j.web_url ? { url: j.web_url } : {}),
              state: gitlabCiStateOf(j.status),
              steps: [],
            }),
          ),
        };
      }),
    );
    return {
      ...common,
      branch,
      ...(headSha ? { headSha } : {}),
      state: workflows.length ? rollup(workflows.map((w) => w.state)) : "none",
      workflows,
    };
  } catch (err) {
    return {
      ...common,
      state: "error",
      error: err instanceof Error ? err.message : String(err),
      workflows: [],
    };
  }
}
