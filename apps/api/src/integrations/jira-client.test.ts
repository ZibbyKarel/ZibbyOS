import { describe, expect, it, vi } from "vitest";
import { createJiraIssue } from "./jira-client";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("createJiraIssue", () => {
  it("posts the minimal ADF issue, resolving the operator via /myself", async () => {
    const calls: { url: string; body?: string }[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body as string | undefined });
      return url.endsWith("/myself") ? json({ accountId: "acc1" }) : json({ key: "ABC-1" }, 201);
    });
    const r = await createJiraIssue(fetchImpl as never, "https://j.example", "Basic x", {
      projectKey: "ABC",
      title: "T",
      body: "one\n\ntwo",
      labels: ["l"],
      assignee: "operator",
      fields: { customfield_1: "v" },
    });
    expect(r).toEqual({ key: "ABC-1", url: "https://j.example/browse/ABC-1" });
    const fields = JSON.parse(calls[1]?.body ?? "{}").fields;
    expect(fields).toMatchObject({
      project: { key: "ABC" },
      issuetype: { name: "Task" },
      summary: "T",
      labels: ["l"],
      assignee: { accountId: "acc1" },
      customfield_1: "v",
    });
    expect(fields.description.content).toHaveLength(2);
  });

  it("retries once without extra fields on a 400 and notes it", async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(init?.body as string);
      return bodies.length === 1
        ? json({ errors: { customfield_1: "bad" } }, 400)
        : json({ key: "ABC-2" }, 201);
    });
    const r = await createJiraIssue(fetchImpl as never, "https://j.example", "Basic x", {
      projectKey: "ABC",
      title: "T",
      body: "b",
      fields: { customfield_1: "v" },
    });
    expect(r.note).toMatch(/extra fields rejected/);
    expect(bodies[0]).toContain("customfield_1");
    expect(bodies[1]).not.toContain("customfield_1");
  });

  it("throws with Jira's reason when the create fails", async () => {
    const fetchImpl = vi.fn(async () => json({ errorMessages: ["nope"] }, 403));
    await expect(
      createJiraIssue(fetchImpl as never, "https://j.example", "Basic x", {
        projectKey: "ABC",
        title: "T",
        body: "b",
      }),
    ).rejects.toThrow(/403 nope/);
  });
});
