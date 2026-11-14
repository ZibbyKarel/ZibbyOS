import type { InboxPrThread } from "@zibby/contracts";
import { FileDiffViewTestId } from "@zibby/design-system";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "../../../../test/render";
import messages from "../../../../i18n/messages/cs.json";
import { ReviewThreadTestId } from "../ReviewThread/ReviewThread";
import { PrDiff } from "./PrDiff";

const hooks = vi.hoisted(() => ({ threads: [] as InboxPrThread[] }));
vi.mock("../../queries", async (orig) => ({
  ...(await orig<typeof import("../../queries")>()),
  useInboxPrThreadsQuery: () => ({ data: hooks.threads }),
}));

const BINARY = `diff --git a/img.png b/img.png
index 333..444 100644
Binary files a/img.png and b/img.png differ
`;

const TEXT = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
 const a = 1;
-const b = 2;
+const b = 3;
`;

const PR = { projectId: "acme", number: 7, headSha: "a".repeat(40) };

const thread = (over: Partial<InboxPrThread> = {}): InboxPrThread => ({
  id: "PRRT_1",
  isResolved: false,
  isOutdated: false,
  path: "src/a.ts",
  line: 2,
  startLine: null,
  diffHunk: "@@ -1,2 +1,2 @@\n const a = 1;\n+const b = 3;",
  comments: [],
  ...over,
});

beforeEach(() => {
  hooks.threads = [];
  window.localStorage.clear();
});

describe("PrDiff", () => {
  it("passes the cs labels to FileDiffView", () => {
    renderWithProviders(<PrDiff diff="" />);
    expect(screen.getByTestId(FileDiffViewTestId.Empty)).toHaveTextContent(
      messages.inboxPage.prs.diff.empty,
    );
    renderWithProviders(<PrDiff diff={BINARY} />);
    expect(screen.getByTestId(FileDiffViewTestId.NoHunks)).toHaveTextContent(
      messages.inboxPage.prs.diff.noHunks,
    );
  });

  it("shows the localized file list", () => {
    renderWithProviders(<PrDiff diff={BINARY} />);
    expect(screen.getByTestId(FileDiffViewTestId.FileList)).toBeInTheDocument();
    expect(screen.getByTestId(FileDiffViewTestId.FileListToggle)).toHaveAccessibleName(
      messages.inboxPage.prs.diff.collapseFiles,
    );
    expect(screen.getByTestId(FileDiffViewTestId.FileListFilter)).toHaveAccessibleName(
      messages.inboxPage.prs.diff.filter,
    );
  });

  it("shows the truncation notice inside the diff", () => {
    renderWithProviders(<PrDiff truncated diff={TEXT} />);
    expect(screen.getByTestId(FileDiffViewTestId.Notice)).toHaveTextContent(
      messages.inboxPage.prs.diff.truncated,
    );
  });

  it("offers the split toggle on desktop", () => {
    renderWithProviders(<PrDiff diff={TEXT} />);
    expect(screen.getByTestId(FileDiffViewTestId.ViewToggle)).toBeInTheDocument();
  });

  it("anchors an open thread under its line and counts it per file", () => {
    hooks.threads = [thread(), thread({ id: "PRRT_2", isResolved: true })];
    renderWithProviders(<PrDiff diff={TEXT} now={0} pr={PR} />);
    expect(screen.getAllByTestId(ReviewThreadTestId.Root)).toHaveLength(1);
    expect(screen.getAllByTestId(FileDiffViewTestId.Threads)[0]).toHaveTextContent("1");
  });

  it("remembers viewed files per PR head", () => {
    const { unmount } = renderWithProviders(<PrDiff diff={TEXT} pr={PR} />);
    fireEvent.click(screen.getByTestId(FileDiffViewTestId.Viewed));
    expect(screen.getByTestId(FileDiffViewTestId.ViewedCount)).toHaveTextContent("1 / 1");
    unmount();
    renderWithProviders(<PrDiff diff={TEXT} pr={PR} />);
    expect(screen.getByTestId(FileDiffViewTestId.Viewed)).toBeChecked();
    renderWithProviders(<PrDiff diff={TEXT} pr={{ ...PR, headSha: "b".repeat(40) }} />);
    expect(screen.getAllByTestId(FileDiffViewTestId.Viewed)[1]).not.toBeChecked();
  });
});
