import type { Meta, StoryObj } from "@storybook/react";
import { FileDiffView } from "./FileDiffView";

const meta: Meta<typeof FileDiffView> = {
  title: "DesignSystem/FileDiffView",
  component: FileDiffView,
};
export default meta;

type Story = StoryObj<typeof FileDiffView>;

const DIFF = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
 export { a, b };
diff --git a/img.png b/img.png
Binary files a/img.png and b/img.png differ
`;

export const Playground: Story = { args: { diff: DIFF } };
export const Empty: Story = { args: { diff: "" } };
export const WithFileList: Story = { args: { diff: DIFF, fileList: true } };

const PR_DIFF = `${DIFF}diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -1 +1 @@
-lockfileVersion: 8
+lockfileVersion: 9
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+// added
+export const c = "c";
`;

/** The PR "Changes" tab: rail with filter, split toggle, threads, viewed, generated file, notice. */
export const PrChanges: Story = {
  args: {
    diff: PR_DIFF,
    fileList: true,
    splitToggle: true,
    notice: "Large diff: generated files are hidden.",
    threadCounts: { "src/a.ts": 1 },
    viewed: { "src/new.ts": true },
    onViewedChange: () => undefined,
  },
};
