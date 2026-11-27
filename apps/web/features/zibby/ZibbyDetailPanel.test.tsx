import { fireEvent, renderWithProviders as render, screen } from "../../test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SheetForSelectionProps } from "../bridge/components/sheets/SheetForSelection";
import { ChatProvider, useChat } from "../chat/ChatContext";
import { chatSelection } from "../chat/chatDetail";
import { ZibbyDetailPanel, ZibbyDetailPanelTestId } from "./ZibbyDetailPanel";
import { ChatWidgetFrameTestId, ChatWidgetRow } from "./widgets/ChatWidgetFrame";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/",
}));
vi.mock("../../hooks/useIsPhone", () => ({ useIsPhone: () => false }));
// The real sheets are covered by their own tests; here only what the panel hands them matters.
vi.mock("../bridge/components/sheets/SheetForSelection", () => ({
  SheetForSelection: ({ selection, onOpen, onClose, frame }: SheetForSelectionProps) => (
    <div data-testid="sheet">
      <span data-testid="sheet-id">{`${selection.kind}:${selection.id}`}</span>
      <span data-testid="sheet-back">{String(Boolean(frame?.nav.onBack))}</span>
      <button
        data-testid="sheet-open"
        onClick={() => onOpen?.(chatSelection("pr", "https://x/pr/1"))}
        type="button"
      />
      <button data-testid="sheet-close" onClick={onClose} type="button" />
    </div>
  ),
}));

/** The overlay's side slot in miniature: a card row, the three slot openers and the detail panel. */
function MiniHost() {
  const {
    detail,
    openDetail,
    closeDetail,
    canvasMode,
    setCanvasMode,
    openCanvas,
    openWeb,
    canvas,
    web,
  } = useChat();
  return (
    <>
      <ChatWidgetRow
        detail={chatSelection("run", "run-1")}
        href="/activity/runs/run-1"
        itemKey="r"
        statusLabel="běží"
        title="Run"
        tone="working"
      />
      <button
        data-testid="open-canvas"
        onClick={() => openCanvas({ id: "c", version: 1, title: "C" })}
        type="button"
      />
      <button
        data-testid="open-web"
        onClick={() => openWeb({ url: "https://a.b" })}
        type="button"
      />
      <span data-testid="slot">
        {[detail && "detail", canvas && "canvas", web && "web"].filter(Boolean).join(",")}
      </span>
      <span data-testid="mode">{canvasMode}</span>
      {detail ? (
        <ZibbyDetailPanel
          full={canvasMode === "full"}
          onClose={closeDetail}
          onOpen={openDetail}
          onToggleFull={() => setCanvasMode(canvasMode === "full" ? "split" : "full")}
          selection={detail}
        />
      ) : null}
    </>
  );
}

const renderHost = () =>
  render(
    <ChatProvider>
      <MiniHost />
    </ChatProvider>,
  );

describe("chat detail in the overlay side slot", () => {
  beforeEach(() => {
    push.mockClear();
    window.localStorage.clear();
  });

  it("opening a card's detail renders the sheet in the slot and does not navigate", () => {
    renderHost();
    const link = screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-r`);
    // `fireEvent` returns false when the click's default (the link's navigation) was prevented.
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.getByTestId("sheet-id")).toHaveTextContent("run:run-1");
    expect(push).not.toHaveBeenCalled();
  });

  it("a modified click keeps the link's own behaviour", () => {
    renderHost();
    fireEvent.click(screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-r`), { metaKey: true });
    expect(screen.queryByTestId(ZibbyDetailPanelTestId.Root)).toBeNull();
  });

  it("a sheet's own onOpen stays in the slot, with a way back", () => {
    renderHost();
    fireEvent.click(screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-r`));
    expect(screen.getByTestId("sheet-back")).toHaveTextContent("false");
    fireEvent.click(screen.getByTestId("sheet-open"));
    expect(screen.getByTestId("sheet-id")).toHaveTextContent("pr:https://x/pr/1");
    expect(screen.getByTestId("sheet-back")).toHaveTextContent("true");
    expect(push).not.toHaveBeenCalled();
  });

  it("toggles split / full and closes back to the plain chat", () => {
    renderHost();
    fireEvent.click(screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-r`));
    expect(screen.getByTestId("mode")).toHaveTextContent("split");
    fireEvent.click(screen.getByTestId(ZibbyDetailPanelTestId.Expand));
    expect(screen.getByTestId("mode")).toHaveTextContent("full");
    fireEvent.click(screen.getByTestId("sheet-close"));
    expect(screen.queryByTestId(ZibbyDetailPanelTestId.Root)).toBeNull();
    expect(screen.getByTestId("slot")).toHaveTextContent("");
  });

  it("shares the one slot: a detail replaces the canvas / web page and vice versa", () => {
    renderHost();
    fireEvent.click(screen.getByTestId("open-canvas"));
    expect(screen.getByTestId("slot")).toHaveTextContent("canvas");
    fireEvent.click(screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-r`));
    expect(screen.getByTestId("slot")).toHaveTextContent(/^detail$/);
    fireEvent.click(screen.getByTestId("open-web"));
    expect(screen.getByTestId("slot")).toHaveTextContent(/^web$/);
    fireEvent.click(screen.getByTestId(`${ChatWidgetFrameTestId.RowLink}-r`));
    expect(screen.getByTestId("slot")).toHaveTextContent(/^detail$/);
    fireEvent.click(screen.getByTestId("open-canvas"));
    expect(screen.getByTestId("slot")).toHaveTextContent(/^canvas$/);
  });
});
