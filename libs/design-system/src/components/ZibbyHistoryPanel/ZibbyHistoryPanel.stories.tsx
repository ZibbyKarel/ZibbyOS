import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DesignSystemProvider } from "../../DesignSystemContext/DesignSystemProvider";
import { Kbd } from "../Kbd/Kbd";
import {
  type ZibbyHistoryGroup,
  ZibbyHistoryPanel,
  type ZibbyHistoryPanelProps,
} from "./ZibbyHistoryPanel";

const meta: Meta<typeof ZibbyHistoryPanel> = {
  title: "DesignSystem/ZibbyHistoryPanel",
  component: ZibbyHistoryPanel,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof ZibbyHistoryPanel>;

const groups: ZibbyHistoryGroup[] = [
  {
    label: "Today",
    items: [
      {
        id: "1",
        title: "Fix CI on partner-cli",
        time: "now",
        snippet: "You: rebase it onto main and rerun the pipeline",
        active: true,
      },
      {
        id: "2",
        title: "Morning briefing",
        time: "08:10",
        snippet: "Two PRs are waiting for your review.",
      },
    ],
  },
  {
    label: "Yesterday",
    items: [
      {
        id: "3",
        title: "Release notes draft",
        time: "Tue",
        snippet: "Drafted notes for v2.4 in the vault.",
      },
    ],
  },
  {
    label: "This week",
    items: [
      { id: "4", title: "Calendar clean-up", time: "Mon", snippet: "Moved the sync to Thursday." },
    ],
  },
  {
    label: "Older",
    items: [{ id: "5", title: "Sentry monitor idea", time: "3. 11.", snippet: "Not now — later." }],
  },
];

const footer = (
  <>
    Saved automatically · <Kbd>⌥ H</Kbd> toggles · double-click renames
  </>
);

function Panel(props: Partial<ZibbyHistoryPanelProps>) {
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  return (
    <div className="flex h-[640px] w-[320px] flex-col border border-line-2 bg-panel text-ink shadow-[var(--shadow-pop)]">
      <ZibbyHistoryPanel
        count={5}
        footer={footer}
        groups={groups}
        onClose={() => undefined}
        onDelete={() => undefined}
        onNew={() => undefined}
        onOpen={() => undefined}
        onQueryChange={setQuery}
        onRename={() => setRenamingId(null)}
        onRenamingIdChange={setRenamingId}
        query={query}
        renamingId={renamingId}
        {...props}
      />
    </div>
  );
}

const frame = (theme: "dark" | "light", children: React.ReactNode) => (
  <DesignSystemProvider
    style={{ padding: 24, background: "var(--color-bg)", height: "auto" }}
    theme={theme}
  >
    {children}
  </DesignSystemProvider>
);

/** "Zibby history": groups, active row, a search with highlighted hits, a row in rename mode, empty state. */
export const Overview: Story = {
  name: "Zibby history",
  render: () => (
    <div className="flex">
      {(["dark", "light"] as const).map((theme) =>
        frame(
          theme,
          <div className="flex gap-6" key={theme}>
            <Panel />
            <Panel
              groups={[
                {
                  label: "Today",
                  items: [
                    {
                      id: "1",
                      title: "Fix CI on partner-cli",
                      time: "now",
                      snippet: "You: rebase it onto main",
                      active: true,
                    },
                  ],
                },
              ]}
              query="rebase"
            />
            <Panel renamingId="2" />
            <Panel emptyLabel="Nothing found for “zzz”" groups={[]} query="zzz" />
          </div>,
        ),
      )}
    </div>
  ),
};

export const Playground: Story = {
  args: { query: "", groups, count: 5, footer },
  render: (args) => <Panel {...args} />,
};
