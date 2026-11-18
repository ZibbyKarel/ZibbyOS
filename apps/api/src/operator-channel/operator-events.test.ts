import type { ActivityEntry } from "@zibby/contracts";
import { describe, expect, it } from "vitest";
import { toOperatorEvent } from "./operator-events";

const lookups = { task: async () => null, approval: async () => null, workflowRun: () => null };
const parked = (itemId: string) =>
  ({
    id: "a1",
    kind: "pr-ci-autofix-parked",
    summary: "gave up",
    refs: { itemId },
  }) as unknown as ActivityEntry;

describe("toOperatorEvent pr-ci-autofix-parked prUrl", () => {
  it.each([
    ["acme/app#5", "https://github.com/acme/app/pull/5"],
    [
      "https://gl.example.com/grp/sub/app/-/merge_requests/5",
      "https://gl.example.com/grp/sub/app/-/merge_requests/5",
    ],
  ])("%s", async (itemId, prUrl) => {
    expect(await toOperatorEvent(parked(itemId), lookups)).toMatchObject({ prUrl });
  });

  it("drops a nested non-url ref it cannot rebuild", async () => {
    const event = await toOperatorEvent(parked("grp/sub/app#5"), lookups);
    expect(event).not.toHaveProperty("prUrl");
  });
});
