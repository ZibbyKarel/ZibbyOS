import { renderWithProviders as render, screen } from "../../../test/render";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import {
  ChatWidgetFrame,
  ChatWidgetFrameTestId,
  ChatWidgetRow,
  takeRows,
  widgetStatus,
} from "./ChatWidgetFrame";

describe("ChatWidgetFrame", () => {
  it("renders header, rows, open-all and +N more", () => {
    render(
      <ChatWidgetFrame
        count={3}
        emptyText="empty"
        hiddenCount={2}
        openHref="/x"
        status="ready"
        title="Karta"
      >
        <ChatWidgetRow itemKey="a" meta="m" statusLabel="běží" title="Řádek" tone="working" />
      </ChatWidgetFrame>,
    );
    expect(screen.getByTestId(ChatWidgetFrameTestId.Root)).toHaveRole("region");
    expect(screen.getByTestId(ChatWidgetFrameTestId.Root)).toHaveAccessibleName("Karta");
    expect(screen.getByTestId(ChatWidgetFrameTestId.Count)).toHaveTextContent("3");
    expect(screen.getByTestId(ChatWidgetFrameTestId.OpenAll)).toHaveAttribute("href", "/x");
    expect(screen.getByTestId(`${ChatWidgetFrameTestId.RowStatus}-a`)).toHaveTextContent(
      "běží · m",
    );
    expect(screen.getByTestId(ChatWidgetFrameTestId.More)).toHaveTextContent("+2 dalších");
  });

  it("shows loading, empty and error (with retry) states", async () => {
    const retry = vi.fn();
    const { rerender } = render(<ChatWidgetFrame emptyText="Nic" status="loading" title="T" />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.Loading)).toHaveRole("status");
    rerender(<ChatWidgetFrame emptyText="Nic" status="empty" title="T" />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.Empty)).toHaveTextContent("Nic");
    rerender(<ChatWidgetFrame emptyText="Nic" onRetry={retry} status="error" title="T" />);
    expect(screen.getByTestId(ChatWidgetFrameTestId.Error)).toHaveRole("alert");
    await userEvent.click(screen.getByTestId(ChatWidgetFrameTestId.Retry));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("helpers: takeRows defaults to 5, widgetStatus precedence", () => {
    expect(takeRows([1, 2, 3, 4, 5, 6, 7], undefined)).toEqual({
      shown: [1, 2, 3, 4, 5],
      hiddenCount: 2,
    });
    expect(takeRows([1, 2, 3], 2).hiddenCount).toBe(1);
    expect(widgetStatus({ isPending: true, isError: true, count: 0 })).toBe("error");
    expect(widgetStatus({ isPending: false, isError: false, count: 0 })).toBe("empty");
  });
});
