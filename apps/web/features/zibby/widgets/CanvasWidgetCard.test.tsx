import { CanvasCardTestId } from "@zibby/design-system";
import { fireEvent, renderWithProviders as render, screen } from "../../../test/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasWidgetCard } from "./CanvasWidgetCard";

const openCanvas = vi.fn();
vi.mock("../../chat/ChatContext", () => ({ useOptionalChat: () => ({ openCanvas }) }));
let phone = false;
vi.mock("../../../hooks/useIsPhone", () => ({ useIsPhone: () => phone }));

const widget = { kind: "canvas", id: "abc1234567", version: 3, title: "Plan" } as const;

describe("CanvasWidgetCard", () => {
  beforeEach(() => {
    phone = false;
    vi.stubEnv("NEXT_PUBLIC_CANVAS_URL", "http://localhost:3334");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    openCanvas.mockClear();
  });

  it("desktop: opens the canvas in the panel with a host-based thumbnail", () => {
    render(<CanvasWidgetCard widget={widget} />);
    expect(screen.getByTestId(CanvasCardTestId.Frame)).toHaveAttribute(
      "src",
      "http://abc1234567.canvas.localhost:3334/v3/",
    );
    fireEvent.click(screen.getByTestId(CanvasCardTestId.Root));
    expect(openCanvas).toHaveBeenCalledWith({ id: "abc1234567", version: 3, title: "Plan" });
  });

  it("phone: a link to the path-based url", () => {
    phone = true;
    render(<CanvasWidgetCard widget={widget} />);
    const root = screen.getByTestId(CanvasCardTestId.Root);
    expect(root).toHaveAttribute("href", "http://localhost:3334/a/abc1234567/v3/");
    fireEvent.click(root);
    expect(openCanvas).not.toHaveBeenCalled();
  });

  it("no canvas origin: shows the open-on-the-Mac note", () => {
    vi.stubEnv("NEXT_PUBLIC_CANVAS_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    render(<CanvasWidgetCard widget={widget} />);
    expect(screen.getByTestId(CanvasCardTestId.Note)).toHaveTextContent("Otevřít na Macu");
  });
});
