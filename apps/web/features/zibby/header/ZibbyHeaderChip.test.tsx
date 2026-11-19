import userEvent from "@testing-library/user-event";
import { ZibbyChipTestId, ZibbyOrbTestId } from "@zibby/design-system";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "../../../test/render";
import { ChatProvider, useChat } from "../../chat/ChatContext";
import { ZibbyLiveProvider, usePublishZibbyLive } from "../live/ZibbyLiveContext";
import { ZibbyHeaderChip, ZibbyHeaderChipTestId } from "./ZibbyHeaderChip";

function OpenFlag() {
  const { dockOpen } = useChat();
  return <span data-testid="open-flag">{String(dockOpen)}</span>;
}

/** Stands in for the host: publishes the overlay's live phase + orb state. */
function Publisher({
  phase,
  orbState,
}: {
  phase: "closed" | "open";
  orbState: "listen" | "ready";
}) {
  const publish = usePublishZibbyLive();
  useEffect(() => publish({ phase, orbState }), [publish, phase, orbState]);
  return null;
}

function renderChip(
  props: Parameters<typeof ZibbyHeaderChip>[0] = {},
  live?: Parameters<typeof Publisher>[0],
) {
  return renderWithProviders(
    <ChatProvider>
      <ZibbyLiveProvider>
        {live && <Publisher {...live} />}
        <OpenFlag />
        <ZibbyHeaderChip {...props} />
      </ZibbyLiveProvider>
    </ChatProvider>,
  );
}

const orbState = () =>
  screen
    .getByTestId(ZibbyHeaderChipTestId.Root)
    .querySelector(`[data-testid="${ZibbyOrbTestId.Root}"]`)
    ?.getAttribute("data-state");

describe("ZibbyHeaderChip", () => {
  it("shows the orb and the label, with the real shortcut only in the accessible name", () => {
    renderChip();
    const chip = screen.getByTestId(ZibbyHeaderChipTestId.Root);
    expect(chip).toHaveTextContent("Zibby");
    expect(chip).not.toHaveTextContent("Alt");
    expect(chip).toHaveAccessibleName("Vyvolat Zibbyho (Alt Space)");
    expect(screen.getByTestId(ZibbyChipTestId.Orb)).toBeInTheDocument();
  });

  it("shows the system state when closed: asleep, 'work' while agents run, 'needs' when blocked", () => {
    const { unmount } = renderChip();
    expect(orbState()).toBe("sleep");
    unmount();
    const second = renderChip({ systemState: "working" });
    expect(orbState()).toBe("work");
    second.unmount();
    renderChip({ systemState: "blocked" });
    expect(orbState()).toBe("needs");
  });

  it("mirrors the live orb state while the overlay is up", () => {
    renderChip({ systemState: "blocked" }, { phase: "open", orbState: "listen" });
    expect(orbState()).toBe("listen");
  });

  it("is icon-only for the header mini orb (no label, no keys, still named)", () => {
    renderChip({ iconOnly: true });
    const chip = screen.getByTestId(ZibbyHeaderChipTestId.Root);
    expect(chip).toHaveTextContent("");
    expect(chip).toHaveAccessibleName(/Vyvolat Zibbyho/);
  });

  it("summons the overlay on click and closes it on the next", async () => {
    const user = userEvent.setup();
    renderChip();
    await user.click(screen.getByTestId(ZibbyHeaderChipTestId.Root));
    expect(screen.getByTestId("open-flag")).toHaveTextContent("true");
    await user.click(screen.getByTestId(ZibbyHeaderChipTestId.Root));
    expect(screen.getByTestId("open-flag")).toHaveTextContent("false");
  });
});
