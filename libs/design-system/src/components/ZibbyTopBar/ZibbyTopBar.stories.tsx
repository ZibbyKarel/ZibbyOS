import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DesignSystemProvider } from "../../DesignSystemContext/DesignSystemProvider";
import { Button } from "../Button/Button";
import { ZibbyIconButton } from "../ZibbyIconButton/ZibbyIconButton";
import { ZibbyTopBarMenu } from "../ZibbyTopBarMenu/ZibbyTopBarMenu";
import { ZibbyTopBar, type ZibbyTopBarProps } from "./ZibbyTopBar";

const meta: Meta<typeof ZibbyTopBar> = {
  title: "DesignSystem/ZibbyTopBar",
  component: ZibbyTopBar,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof ZibbyTopBar>;

function Bar({
  width = 900,
  menuOpenInitially = false,
  compact = false,
  ...props
}: Partial<ZibbyTopBarProps> & { width?: number; menuOpenInitially?: boolean; compact?: boolean }) {
  const [renaming, setRenaming] = useState(props.renaming ?? false);
  const [title, setTitle] = useState(props.title ?? "Fix CI on partner-cli");
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <div
      className="border border-line-2 bg-bg"
      ref={(node) => {
        if (menuOpenInitially && node) {
          const trigger = node.querySelector<HTMLButtonElement>("[aria-haspopup='menu']");
          if (trigger && trigger.getAttribute("aria-expanded") === "false") trigger.click();
        }
      }}
      style={{ width }}
    >
      <ZibbyTopBar
        actions={
          <>
            <Button aria-label="New conversation" icon="plus" intent="ghost" size="sm">
              {compact ? undefined : "New conversation"}
            </Button>
            <ZibbyTopBarMenu
              items={[
                { id: "rename", label: "Rename", icon: "pen", onSelect: () => setRenaming(true) },
                {
                  id: "clear",
                  label: "Clear and start over",
                  icon: "retry",
                  disabled: true,
                  onSelect: () => undefined,
                },
                {
                  id: "delete",
                  label: "Delete conversation",
                  icon: "trash",
                  danger: true,
                  onSelect: () => undefined,
                },
              ]}
              label="More conversation actions"
            />
            <ZibbyIconButton icon="x" label="Close (Esc)" />
          </>
        }
        historyKbd="⌥ H"
        historyLabel="History"
        historyOpen={historyOpen}
        onHistoryToggle={() => setHistoryOpen((o) => !o)}
        onRename={setTitle}
        onRenamingChange={setRenaming}
        renaming={renaming}
        title={title}
        {...props}
      />
      {menuOpenInitially && <div className="h-[130px]" />}
    </div>
  );
}

const themed = (theme: "dark" | "light", children: React.ReactNode) => (
  <DesignSystemProvider
    key={theme}
    style={{ padding: 24, background: "var(--color-canvas)", height: "auto" }}
    theme={theme}
  >
    {children}
  </DesignSystemProvider>
);

/** "Zibby top bar": default, history open, renaming, menu open — dark and light. */
export const Overview: Story = {
  name: "Zibby top bar",
  render: () => (
    <div>
      {(["dark", "light"] as const).map((theme) =>
        themed(
          theme,
          <div className="flex flex-col gap-4 text-ink">
            <Bar />
            <Bar historyOpen onHistoryToggle={() => undefined} />
            <Bar renaming />
            <Bar menuOpenInitially />
            <Bar
              compact
              title="A very long conversation title that has to be truncated with an ellipsis somewhere"
              width={420}
            />
          </div>,
        ),
      )}
    </div>
  ),
};

export const Playground: Story = {
  args: { title: "Fix CI on partner-cli", historyOpen: false, historyKbd: "⌥ H" },
  render: (args) => (
    <div className="p-6 text-ink">
      <Bar {...args} />
    </div>
  ),
};
