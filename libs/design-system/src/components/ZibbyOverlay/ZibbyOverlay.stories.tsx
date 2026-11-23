import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";
import { Button } from "../Button/Button";
import { CanvasCard } from "../CanvasCard/CanvasCard";
import { CanvasPanel } from "../CanvasPanel/CanvasPanel";
import { Icon } from "../Icon/Icon";
import { ZibbyOrb, type ZibbyOrbState } from "../ZibbyOrb/ZibbyOrb";
import { ZibbyOverlay, type ZibbyOverlayPhase, type ZibbyOverlayProps } from "./ZibbyOverlay";

const meta: Meta<typeof ZibbyOverlay> = {
  title: "DesignSystem/ZibbyOverlay",
  component: ZibbyOverlay,
  parameters: { layout: "fullscreen" },
  argTypes: { compact: { control: "boolean" }, dropActive: { control: "boolean" } },
};
export default meta;

type Story = StoryObj<typeof ZibbyOverlay>;

const bubble = "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px]";

function Demo({
  compact,
  dropActive,
  startOpen = false,
  withSide = false,
}: Partial<ZibbyOverlayProps> & { startOpen?: boolean; withSide?: boolean }) {
  const [sideOn, setSideOn] = useState(withSide);
  const [sideMode, setSideMode] = useState<"split" | "full">("split");
  const [open, setOpen] = useState(startOpen);
  const [history, setHistory] = useState(false);
  const [orbState, setOrbState] = useState<ZibbyOrbState>("sleep");
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>({ x: 34, y: 26 });
  const knot = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const r = knot.current?.getBoundingClientRect();
    if (r) setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    setOpen((o) => !o);
  };
  const onPhase = (p: ZibbyOverlayPhase) =>
    setOrbState(
      p === "summoning" ? "wake" : p === "open" ? "ready" : p === "leaving" ? "wake" : "sleep",
    );

  return (
    <div className="flex h-screen w-full flex-col gap-4 bg-background p-4 text-ink">
      <div className="flex items-center gap-3">
        <button
          aria-label="Summon Zibby"
          className="grid size-[34px] place-items-center rounded-full border border-line-2"
          onClick={toggle}
          ref={knot}
          type="button"
        >
          <Icon name="sparkles" size="md" />
        </button>
        <Button onClick={toggle}>{open ? "Close overlay" : "Open overlay"}</Button>
        <Button intent="secondary" onClick={() => setSideOn((v) => !v)}>
          {sideOn ? "Hide canvas" : "Show canvas"}
        </Button>
        <span className="text-[12px] text-ink-3">
          The orb flies from the round button at the top left.
        </span>
      </div>
      <p className="text-ink-2">Page content behind the overlay.</p>
      <ZibbyOverlay
        attachments={
          <span className="inline-flex items-center gap-2 rounded-lg border border-line-2 bg-panel-2 px-2.5 py-1.5 text-[12px]">
            <Icon name="file" size="sm" /> pipeline-8815.log
          </span>
        }
        compact={compact}
        composer={
          <div className="flex items-center gap-2.5 rounded-[22px] border border-line-2 bg-panel p-2 shadow-pop">
            <Button icon="mic" intent="secondary" size="sm">
              Hold Space and talk
            </Button>
            <input
              aria-label="Message"
              className="min-w-0 flex-1 bg-transparent px-2 text-[14px] text-ink outline-none placeholder:text-ink-3"
              placeholder="or type…"
            />
            <Button aria-label="Send" icon="arrow" intent="primary" size="sm" />
          </div>
        }
        dropActive={dropActive}
        dropHint="Zibby reads them and attaches them to the conversation"
        dropTitle="Drop files here"
        footer={
          <>
            <span>Hold Space</span>
            <span className="flex-1" />
            <span>Esc closes</span>
          </>
        }
        hint="Release Space to send"
        history={
          <div className="flex flex-col gap-2 p-4 text-[13px]">
            <b>Conversations</b>
            <span className="text-ink-2">Why is CI red?</span>
            <span className="text-ink-2">Weekly briefing</span>
          </div>
        }
        historyLabel="History"
        historyOpen={history}
        label="Zibby"
        live={
          <>
            show me what failed in the last <span className="text-ink-3">pipeline</span>
          </>
        }
        onHistoryOpenChange={setHistory}
        onOpenChange={setOpen}
        onPhaseChange={onPhase}
        onSideDismiss={(m) => (m === "full" ? setSideMode("split") : setSideOn(false))}
        open={open}
        orb={<ZibbyOrb size={140} state={orbState} />}
        origin={origin}
        pinned={
          compact && sideOn ? (
            <CanvasCard
              onOpen={() => setSideOn(false)}
              size="pin"
              src="about:blank"
              title="Demo"
              version={2}
            />
          ) : undefined
        }
        scrollKey={1}
        side={
          sideOn ? (
            <CanvasPanel
              full={sideMode === "full"}
              onClose={() => setSideOn(false)}
              onToggleFull={() => setSideMode((m) => (m === "full" ? "split" : "full"))}
              src="about:blank"
              status="ready"
              title="Demo canvas"
              version={2}
            />
          ) : undefined
        }
        sideMode={sideMode}
        status={<span>Listening</span>}
        suggestions={<span>Try saying: &ldquo;what needs me today?&rdquo;</span>}
        thread={
          <>
            <div className={`${bubble} self-end border border-line-2 bg-panel-2`}>
              Why is the build red?
            </div>
            <div className={`${bubble} text-ink-2`}>
              Pipeline 8815 failed on the lint step: two unused imports in the API module. I
              prepared a fix on a branch.
            </div>
            <div className={`${bubble} self-end border border-line-2 bg-panel-2`}>Open the PR.</div>
          </>
        }
        toast={
          history ? (
            <div className="flex h-[38px] items-center rounded-full bg-ink px-4 text-[13px] text-on-ink">
              Conversation cleared
            </div>
          ) : undefined
        }
        topBar={
          <>
            <Button icon="clock" intent="secondary" onClick={() => setHistory((h) => !h)} size="sm">
              History
            </Button>
            <span className="flex-1" />
            <Button
              aria-label="Close"
              icon="x"
              intent="ghost"
              onClick={() => setOpen(false)}
              size="sm"
            />
          </>
        }
      />
    </div>
  );
}

export const Overview: Story = {
  render: () => (
    <div className="flex flex-col gap-0">
      <Demo startOpen />
    </div>
  ),
};

export const Playground: Story = {
  args: { compact: false, dropActive: false },
  render: (args) => <Demo compact={args.compact} dropActive={args.dropActive} />,
};
