import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { MobileToolbar, MobileToolbarTestId } from "./MobileToolbar";

describe("MobileToolbar", () => {
  it("renders leading and actions slots in a header", () => {
    render(<MobileToolbar actions={<button>act</button>} leading={<button>lead</button>} />);
    expect(screen.getByTestId(MobileToolbarTestId.Root).tagName).toBe("HEADER");
    expect(screen.getByTestId(MobileToolbarTestId.Leading)).toHaveTextContent("lead");
    expect(screen.getByTestId(MobileToolbarTestId.Actions)).toHaveTextContent("act");
  });

  it("omits the leading wrapper without leading", () => {
    render(<MobileToolbar actions={<span>a</span>} />);
    expect(screen.queryByTestId(MobileToolbarTestId.Leading)).toBeNull();
  });

  it("renders brand and section title in order inside the bar", () => {
    render(
      <MobileToolbar brand={<span>knot</span>} leading={<span>menu</span>} title="Dashboard" />,
    );
    const bar = screen.getByTestId(MobileToolbarTestId.Bar);
    expect(bar).toContainElement(screen.getByTestId(MobileToolbarTestId.Brand));
    expect(screen.getByTestId(MobileToolbarTestId.Title)).toHaveTextContent("Dashboard");
    expect(
      screen
        .getByTestId(MobileToolbarTestId.Leading)
        .compareDocumentPosition(screen.getByTestId(MobileToolbarTestId.Brand)),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("shows the status band with its action only when a banner is given", () => {
    const { rerender } = render(<MobileToolbar title="x" />);
    expect(screen.queryByTestId(MobileToolbarTestId.Banner)).toBeNull();
    rerender(<MobileToolbar banner="Paused" bannerAction={<a href="/x">Resume</a>} />);
    expect(screen.getByTestId(MobileToolbarTestId.Banner)).toHaveTextContent("Paused");
    expect(screen.getByTestId(MobileToolbarTestId.BannerAction)).toHaveTextContent("Resume");
  });

  it("omits the banner action without bannerAction", () => {
    render(<MobileToolbar banner="Paused" />);
    expect(screen.queryByTestId(MobileToolbarTestId.BannerAction)).toBeNull();
  });
});
