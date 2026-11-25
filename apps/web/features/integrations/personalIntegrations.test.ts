import { describe, expect, it } from "vitest";
import type { Integration } from "@zibby/contracts";
import { selectPersonalIntegrations } from "./queries/usePersonalIntegrationsQuery";

describe("selectPersonalIntegrations", () => {
  it("keeps only accounts with no owning company", () => {
    const body = [
      { id: "acme-jira", companyId: "acme" },
      { id: "my-gmail" },
      { id: "my-github" },
    ] as Integration[];
    expect(selectPersonalIntegrations({ body }).map((i) => i.id)).toEqual([
      "my-gmail",
      "my-github",
    ]);
  });
});
