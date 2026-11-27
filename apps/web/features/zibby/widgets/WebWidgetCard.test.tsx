import { fireEvent, renderWithProviders as render, screen } from "../../../test/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebWidgetCard, WebWidgetCardTestId } from "./WebWidgetCard";

const openWeb = vi.fn();
vi.mock("../../chat/ChatContext", () => ({ useOptionalChat: () => ({ openWeb }) }));
let phone = false;
vi.mock("../../../hooks/useIsPhone", () => ({ useIsPhone: () => phone }));

const widget = { kind: "web", url: "https://example.com/docs", title: "Docs" } as const;

describe("WebWidgetCard", () => {
  beforeEach(() => {
    phone = false;
  });
  afterEach(() => {
    delete (window as unknown as { zibbyDesktop?: unknown }).zibbyDesktop;
    openWeb.mockClear();
  });

  it("desktop app: opens the page in the side panel", () => {
    (window as unknown as { zibbyDesktop: unknown }).zibbyDesktop = { web: {} };
    render(<WebWidgetCard widget={widget} />);
    fireEvent.click(screen.getByTestId(WebWidgetCardTestId.Open));
    expect(openWeb).toHaveBeenCalledWith({ url: "https://example.com/docs", title: "Docs" });
    expect(screen.queryByTestId(WebWidgetCardTestId.Link)).toBeNull();
  });

  it("no desktop bridge: a link card for the system browser, no iframe", () => {
    const { container } = render(<WebWidgetCard widget={widget} />);
    const link = screen.getByTestId(WebWidgetCardTestId.Link);
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("phone: a link even when a bridge exists", () => {
    phone = true;
    (window as unknown as { zibbyDesktop: unknown }).zibbyDesktop = { web: {} };
    render(<WebWidgetCard widget={widget} />);
    expect(screen.getByTestId(WebWidgetCardTestId.Link)).toBeInTheDocument();
  });
});
