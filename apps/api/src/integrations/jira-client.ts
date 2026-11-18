import type { CredentialsInput, JiraConfig } from "@zibby/contracts";

/** Bounds the pagination loop — a full fetch must still terminate. */
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

/** PAT/API-token from the closed credentials union (null if absent). */
export function tokenOf(creds: CredentialsInput | null): string | null {
  return creds && "token" in creds ? creds.token : null;
}

/** Jira Cloud Basic auth: `email:apiToken`. */
export function jiraAuthHeader(config: JiraConfig, token: string): string {
  return `Basic ${Buffer.from(`${config.email}:${token}`).toString("base64")}`;
}

export interface JiraStatus {
  name?: string;
  statusCategory?: { key?: string };
}

export interface JiraIssue {
  key?: string;
  fields?: {
    summary?: string;
    /** ADF JSON (API v3), not plain text — see `adfToMarkdown`. */
    description?: unknown;
    issuetype?: { name?: string; hierarchyLevel?: number };
    parent?: {
      key?: string;
      fields?: {
        summary?: string;
        status?: JiraStatus;
        issuetype?: { name?: string; hierarchyLevel?: number };
      };
    };
    status?: JiraStatus;
    updated?: string;
    [field: string]: unknown;
  };
}

interface JiraSearchResponse {
  issues?: JiraIssue[];
  /** Cursor pagination (`/search/jql`): the token for the NEXT page, absent on the last. */
  nextPageToken?: string;
  isLast?: boolean;
  errorMessages?: string[];
}

/**
 * Every issue matching `jql` via `/rest/api/3/search/jql`. The old offset-based `/search` was
 * removed by Atlassian (410 Gone); this one paginates by an opaque `nextPageToken` cursor and
 * returns no `total` — a page is the last when it says `isLast` or omits `nextPageToken`.
 */
export async function searchJira(
  fetchImpl: typeof fetch,
  baseUrl: string,
  authHeader: string,
  jql: string,
  fields: string,
): Promise<JiraIssue[]> {
  const out: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ jql, maxResults: String(PAGE_SIZE), fields });
    if (nextPageToken) params.set("nextPageToken", nextPageToken);
    const res = await fetchImpl(`${baseUrl}/rest/api/3/search/jql?${params}`, {
      headers: { authorization: authHeader, accept: "application/json" },
    });
    if (res.status === 429) {
      throw new Error(`jira rate limited (retry_after ${res.headers.get("retry-after") ?? "?"})`);
    }
    const body = (await res.json()) as JiraSearchResponse;
    if (!res.ok) {
      throw new Error(`jira search: ${body.errorMessages?.join("; ") ?? `HTTP ${res.status}`}`);
    }
    const issues = body.issues ?? [];
    out.push(...issues);
    if (issues.length === 0 || body.isLast || !body.nextPageToken) break;
    nextPageToken = body.nextPageToken;
  }
  return out;
}

export interface JiraIssueSpec {
  projectKey: string;
  issueType?: string;
  title: string;
  /** Markdown-ish text: rendered as one ADF paragraph per blank-line block. */
  body: string;
  labels?: string[];
  /** `"operator"` = the token's own account; anything else is a Jira accountId. */
  assignee?: string;
  parent?: string;
  /** Extra fields by Jira field id (team, components, …); dropped on a 400 retry. */
  fields?: Record<string, unknown>;
}

const adfDoc = (text: string) => ({
  type: "doc",
  version: 1,
  content: text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({ type: "paragraph", content: [{ type: "text", text: block }] })),
});

/**
 * Creates one Jira issue (`POST /rest/api/3/issue`). Extra `fields` from the filer agent are
 * best-effort: on a 400 the create is retried once without them and `note` says so.
 */
export async function createJiraIssue(
  fetchImpl: typeof fetch,
  baseUrl: string,
  authHeader: string,
  spec: JiraIssueSpec,
): Promise<{ key: string; url: string; note?: string }> {
  const headers = {
    authorization: authHeader,
    accept: "application/json",
    "content-type": "application/json",
  };
  let accountId = spec.assignee;
  if (spec.assignee === "operator") {
    const res = await fetchImpl(`${baseUrl}/rest/api/3/myself`, { headers });
    if (!res.ok) throw new Error(`jira myself: HTTP ${res.status}`);
    accountId = ((await res.json()) as { accountId?: string }).accountId;
  }
  const base = {
    project: { key: spec.projectKey },
    issuetype: { name: spec.issueType ?? "Task" },
    summary: spec.title,
    description: adfDoc(spec.body),
    ...(spec.labels?.length ? { labels: spec.labels } : {}),
    ...(accountId ? { assignee: { accountId } } : {}),
    ...(spec.parent ? { parent: { key: spec.parent } } : {}),
  };
  const post = (fields: Record<string, unknown>) =>
    fetchImpl(`${baseUrl}/rest/api/3/issue`, {
      method: "POST",
      headers,
      body: JSON.stringify({ fields }),
    });
  const extra = spec.fields && Object.keys(spec.fields).length > 0 ? spec.fields : undefined;
  let res = await post({ ...(extra ?? {}), ...base });
  let note: string | undefined;
  if (res.status === 400 && extra) {
    res = await post(base);
    note = "extra fields rejected by Jira (400), created without them";
  }
  const json = (await res.json().catch(() => ({}))) as {
    key?: string;
    errorMessages?: string[];
    errors?: Record<string, string>;
  };
  if (!res.ok || !json.key) {
    const why = [...(json.errorMessages ?? []), ...Object.values(json.errors ?? {})].join("; ");
    throw new Error(`jira create issue: HTTP ${res.status}${why ? ` ${why}` : ""}`);
  }
  return {
    key: json.key,
    url: `${baseUrl.replace(/\/+$/, "")}/browse/${json.key}`,
    ...(note ? { note } : {}),
  };
}
