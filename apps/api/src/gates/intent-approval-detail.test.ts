import { describe, expect, it } from "vitest";
import { intentApprovalDetail } from "./intent-approval-detail";

describe("intentApprovalDetail", () => {
  it("prefers the action's own context", () => {
    expect(intentApprovalDetail({ action: "delete", context: "{}" }, "prompt")).toBe("{}");
  });
  it("names the branch for a push without context", () => {
    expect(intentApprovalDetail({ action: "git.force_push", branch: "main" }, "run prompt")).toBe(
      "git.force_push → main\n\nrun prompt",
    );
  });
  it("names every branch, scope and tool", () => {
    expect(intentApprovalDetail({ action: "git.push", branches: ["a", "b"] })).toBe(
      "git.push → a, b",
    );
    expect(intentApprovalDetail({ action: "delete", scope: "/tmp/x.txt", tool: "Bash" })).toBe(
      "delete → /tmp/x.txt (Bash)",
    );
  });
});
