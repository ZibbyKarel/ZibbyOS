import type {
  ChannelItem,
  CredentialsInput,
  ExternalRef,
  Integration,
  TestResult,
} from "@zibby/contracts";
import {
  GitlabApiError,
  type GitlabClient,
  glabLoginHint as loginHint,
  projectPath,
} from "../../git-host/gitlab-client";
import type { ChannelAdapter, InboundMessage, PollResult } from "./adapter";

/** An issue or merge request as `glab api` returns it (only the fields read here). */
interface GitLabItem {
  iid?: number;
  title?: string;
  description?: string | null;
  updated_at?: string;
  web_url?: string;
  author?: { username?: string };
}

/** A `GET /todos` row (only the fields read here). */
interface GitLabTodo {
  target_type?: string;
  target?: GitLabItem;
  project?: { path_with_namespace?: string };
}

const MENTION_ACTIONS = ["mentioned", "directly_addressed"] as const;

/**
 * GitLab adapter over the `glab` CLI ({@link GitlabClient}) — no stored credential, the
 * CLI holds the login. Mirrors {@link GitHubChannelAdapter}: a first poll (no cursor)
 * seeds the cursor to "now" and ingests nothing; later polls fetch only what changed
 * since. Scope is "mine and mentions", never wider: `issues` = open issues assigned to
 * or authored by `config.username`; `pulls` = open MRs where they are author, assignee
 * or reviewer; plus the operator's pending `mentioned`/`directly_addressed` todos for
 * this project (each filtered by its own stream). Issue and MR iids are separate
 * sequences, so ids are `gl-<repo>-issue|mr-<iid>`. A failing todos read degrades to a
 * note (issues/MRs still ingest); any other failure throws to the watcher's retry/backoff.
 */
export class GitlabChannelAdapter implements ChannelAdapter {
  readonly kind = "gitlab" as const;

  constructor(private readonly client: GitlabClient) {}

  async test(integration: Integration): Promise<TestResult> {
    if (integration.config.kind !== "gitlab")
      return { ok: false, detail: "not a gitlab integration" };
    const { host, username } = integration.config;
    try {
      const me = await this.client.api<{ username?: string }>(host, "user");
      if (!me?.username) return { ok: false, detail: `glab returned no user for ${host}` };
      if (me.username.toLowerCase() !== username.toLowerCase()) {
        return {
          ok: false,
          detail: `glab on ${host} is logged in as ${me.username}, not ${username} — fix the username or ${loginHint(host)}`,
        };
      }
      return { ok: true, detail: `authenticated as ${me.username} on ${host}` };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // A 401 already carries the hint (GitlabClient); every other failure (404 included) gets it here.
      const hint = reason.includes(loginHint(host)) ? "" : ` — ${loginHint(host)}`;
      return { ok: false, detail: `glab cannot reach ${host} (${reason})${hint}` };
    }
  }

  async poll(
    integration: Integration,
    _creds: CredentialsInput,
    cursor: string | undefined,
  ): Promise<PollResult> {
    if (integration.config.kind !== "gitlab") throw new Error("not a gitlab integration");
    const { host, repo, streams, username } = integration.config;
    // A company-owned integration is polled per inheriting project's repo: the watcher
    // fills `config.repo` in for each one.
    if (!repo) throw new Error("gitlab integration has no repo");
    // First enable: seed the cursor to "now", ingest nothing (never backfill history).
    if (cursor === undefined) return { items: [], cursor: new Date().toISOString() };

    const base = projectPath(repo);
    const list = async (resource: "issues" | "merge_requests", filter: Record<string, string>) => {
      const params = new URLSearchParams({
        state: "opened",
        scope: "all",
        order_by: "updated_at",
        sort: "asc",
        per_page: "50",
        updated_after: cursor,
        ...filter,
      });
      // Bounded by `updated_after`; paginate so a full page never hides the rest.
      return this.client.api<GitLabItem[]>(host, `${base}/${resource}?${params}`, {
        paginate: true,
      });
    };

    const issues = new Map<number, GitLabItem>();
    const mrs = new Map<number, GitLabItem>();
    const collect = (into: Map<number, GitLabItem>, found: GitLabItem[] | undefined) => {
      for (const item of found ?? []) if (item.iid !== undefined) into.set(item.iid, item);
    };
    if (streams.includes("issues")) {
      collect(issues, await list("issues", { assignee_username: username }));
      collect(issues, await list("issues", { author_username: username }));
    }
    if (streams.includes("pulls")) {
      for (const key of ["author_username", "assignee_username", "reviewer_username"]) {
        collect(mrs, await list("merge_requests", { [key]: username }));
      }
    }

    const notes: string[] = [];
    try {
      for (const todo of await this.mentionTodos(host)) {
        const { target } = todo;
        if (target?.iid === undefined) continue;
        if (todo.project?.path_with_namespace?.toLowerCase() !== repo.toLowerCase()) continue;
        if ((target.updated_at ?? "") < cursor) continue;
        if (todo.target_type === "Issue" && streams.includes("issues"))
          issues.set(target.iid, target);
        if (todo.target_type === "MergeRequest" && streams.includes("pulls"))
          mrs.set(target.iid, target);
      }
    } catch (err) {
      // A 429 is transient and must retry like any other poll failure; anything else is a
      // scope/permission problem — keep ingesting issues and MRs, tell the operator.
      if (err instanceof GitlabApiError && err.status === 429) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      notes.push(
        `gitlab mentions unavailable for ${integration.id} (${reason}) — polling assigned/authored/reviewing only`,
      );
    }

    const all = [
      ...[...issues.values()].map((raw) => ({ raw, isMr: false })),
      ...[...mrs.values()].map((raw) => ({ raw, isMr: true })),
    ].sort((a, b) => (a.raw.updated_at ?? "").localeCompare(b.raw.updated_at ?? ""));

    const items: InboundMessage[] = [];
    let newest = cursor;
    for (const { raw, isMr } of all) {
      if (raw.iid === undefined) continue;
      const updated = raw.updated_at ?? new Date(0).toISOString();
      const ref: ExternalRef = { channel: repo, messageId: String(raw.iid) };
      items.push({
        id: `gl-${repo.replaceAll("/", "-")}-${isMr ? "mr" : "issue"}-${raw.iid}`,
        externalRef: ref,
        from: raw.author?.username,
        receivedAt: new Date(updated).toISOString(),
        text: `#${raw.iid} ${raw.title ?? ""}${raw.description ? `\n\n${raw.description}` : ""}`.trim(),
        raw,
        ...(raw.web_url ? { url: raw.web_url } : {}),
      });
      if (updated > newest) newest = updated;
    }
    return { items, cursor: newest, ...(notes.length ? { notes } : {}) };
  }

  /** The operator's pending mention todos (every project — the caller filters to its repo). */
  private async mentionTodos(host: string): Promise<GitLabTodo[]> {
    const todos: GitLabTodo[] = [];
    for (const action of MENTION_ACTIONS) {
      const params = new URLSearchParams({ state: "pending", action, per_page: "100" });
      const page = await this.client.api<GitLabTodo[]>(host, `todos?${params}`, {
        paginate: true,
      });
      todos.push(...(page ?? []));
    }
    return todos;
  }

  async send(
    integration: Integration,
    _creds: CredentialsInput,
    item: ChannelItem,
    text: string,
  ): Promise<void> {
    if (integration.config.kind !== "gitlab") throw new Error("not a gitlab integration");
    const iid = item.externalRef.messageId;
    if (!iid) throw new Error("gitlab item has no issue/mr number");
    // A repo-less company integration spans many repos: use the item's own.
    const repo = integration.config.repo ?? item.externalRef.channel;
    if (!repo) throw new Error("gitlab item has no repo");
    const resource = /-mr-\d+$/.test(item.id) ? "merge_requests" : "issues";
    await this.client.api(
      integration.config.host,
      `${projectPath(repo)}/${resource}/${iid}/notes`,
      {
        method: "POST",
        body: { body: text },
      },
    );
  }
}
