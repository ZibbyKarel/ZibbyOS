import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "../../utils/testRender";
import { BrandMarkTestId } from "../BrandMark/BrandMark";
import { WordmarkTestId } from "../Wordmark/Wordmark";
import { AppHeader, AppHeaderTestId } from "./AppHeader";

describe("AppHeader", () => {
  it("renders the default Wordmark when no wordmark slot is given", () => {
    render(<AppHeader />);
    expect(screen.getByTestId(AppHeaderTestId.Wordmark)).toHaveTextContent("zibby.");
  });

  it("passes the version to the default Wordmark, inside its small-screen-hidden wrapper", () => {
    render(<AppHeader version="v0.2.1" />);
    const version = screen.getByTestId(WordmarkTestId.Version);
    expect(version).toHaveTextContent("v0.2.1");
    expect(version.closest(".hidden.md\\:inline-flex")).not.toBeNull();
  });

  it("renders the brand mark beside the default wordmark", () => {
    render(<AppHeader />);
    expect(screen.getByTestId(BrandMarkTestId.Root)).toBeInTheDocument();
  });

  it("shows the system state live in the mark's knot", () => {
    render(<AppHeader markState="working" />);
    const mark = screen.getByTestId(BrandMarkTestId.Root);
    expect(mark).toHaveAttribute("data-state", "working");
    expect(mark).toHaveAttribute("data-live", "true");
  });

  it("shows a static emerald mark when no state is given", () => {
    render(<AppHeader />);
    const mark = screen.getByTestId(BrandMarkTestId.Root);
    expect(mark).toHaveAttribute("data-state", "done");
    expect(mark).not.toHaveAttribute("data-live");
  });

  it("renders a custom wordmark slot", () => {
    render(<AppHeader wordmark={<span>Custom mark</span>} />);
    expect(screen.getByTestId(AppHeaderTestId.Wordmark)).toHaveTextContent("Custom mark");
  });

  it("renders the nav slot content", () => {
    render(<AppHeader nav={<nav>Section nav</nav>} />);
    expect(screen.getByTestId(AppHeaderTestId.Nav)).toHaveTextContent("Section nav");
  });

  it("omits optional slots when not provided", () => {
    render(<AppHeader />);
    for (const id of [
      AppHeaderTestId.Search,
      AppHeaderTestId.Create,
      AppHeaderTestId.Zibby,
      AppHeaderTestId.Status,
      AppHeaderTestId.Mode,
      AppHeaderTestId.Notifications,
      AppHeaderTestId.Preferences,
      AppHeaderTestId.Nav,
    ]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it("lays out zone A (brand + nav), the centred search, zone B, a divider and zone C in order", () => {
    render(<AppHeader nav={<nav>n</nav>} />);
    const order = [
      AppHeaderTestId.ZoneA,
      AppHeaderTestId.ZoneSearch,
      AppHeaderTestId.ZoneB,
      AppHeaderTestId.Divider,
      AppHeaderTestId.ZoneC,
    ].map((id) => screen.getByTestId(id));
    for (let i = 1; i < order.length; i++) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    const zoneA = screen.getByTestId(AppHeaderTestId.ZoneA);
    expect(zoneA).toContainElement(screen.getByTestId(AppHeaderTestId.Wordmark));
    expect(zoneA).toContainElement(screen.getByTestId(AppHeaderTestId.Nav));
  });

  it("puts create and zibby in zone B and the search trigger in its own centre cell", () => {
    render(
      <AppHeader
        create={<button type="button">New</button>}
        onSearchClick={() => {}}
        zibby={<button type="button">Zibby</button>}
      />,
    );
    const zoneB = screen.getByTestId(AppHeaderTestId.ZoneB);
    expect(zoneB).toContainElement(screen.getByTestId(AppHeaderTestId.Create));
    expect(zoneB).toContainElement(screen.getByTestId(AppHeaderTestId.Zibby));
    expect(zoneB).not.toContainElement(screen.getByTestId(AppHeaderTestId.Search));
    expect(screen.getByTestId(AppHeaderTestId.ZoneSearch)).toContainElement(
      screen.getByTestId(AppHeaderTestId.Search),
    );
  });

  it("is a centred grid; the search is wide, and only icon + shortcut when compact", () => {
    const { rerender } = render(<AppHeader onSearchClick={() => {}} searchLabel="Hledat" />);
    expect(screen.getByTestId(AppHeaderTestId.Root).className).toContain(
      "grid-cols-[1fr_auto_1fr]",
    );
    expect(screen.getByTestId(AppHeaderTestId.ZoneSearch).className).toContain(
      "w-[min(560px,40vw)]",
    );
    expect(screen.getByTestId(AppHeaderTestId.Search)).toHaveTextContent("Hledat");
    rerender(<AppHeader searchCompact onSearchClick={() => {}} searchLabel="Hledat" />);
    expect(screen.getByTestId(AppHeaderTestId.ZoneSearch).className).not.toContain("w-[min");
    expect(screen.getByTestId(AppHeaderTestId.Search)).not.toHaveTextContent("Hledat");
  });

  it("puts status, mode, notifications and preferences in zone C, in that order", () => {
    render(
      <AppHeader
        mode={<span>Mode</span>}
        notifications={<span>Bell</span>}
        preferences={<span>Prefs</span>}
        status={<span>Status</span>}
      />,
    );
    const zoneC = screen.getByTestId(AppHeaderTestId.ZoneC);
    const ids = [
      AppHeaderTestId.Status,
      AppHeaderTestId.Mode,
      AppHeaderTestId.Notifications,
      AppHeaderTestId.Preferences,
    ].map((id) => screen.getByTestId(id));
    ids.forEach((el) => expect(zoneC).toContainElement(el));
    expect(ids[0]).toHaveTextContent("Status");
    for (let i = 1; i < ids.length; i++) {
      expect(
        ids[i - 1]!.compareDocumentPosition(ids[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("keeps the layout when onSearchClick is omitted", () => {
    render(<AppHeader nav={<nav>Section nav</nav>} />);
    expect(screen.queryByTestId(AppHeaderTestId.Search)).toBeNull();
    expect(screen.getByTestId(AppHeaderTestId.Nav)).toHaveTextContent("Section nav");
  });

  it("renders the search trigger with the ⌘K shortcut and fires onSearchClick", async () => {
    const onSearchClick = vi.fn();
    render(<AppHeader onSearchClick={onSearchClick} />);
    const trigger = screen.getByTestId(AppHeaderTestId.Search);
    expect(trigger).toHaveAccessibleName("Search");
    expect(screen.getByTestId(AppHeaderTestId.SearchShortcut)).toHaveTextContent("⌘K");
    trigger.click();
    expect(onSearchClick).toHaveBeenCalledOnce();
  });

  it("uses a custom searchLabel", () => {
    render(<AppHeader onSearchClick={() => {}} searchLabel="Search agents" />);
    expect(screen.getByTestId(AppHeaderTestId.Search)).toHaveAccessibleName("Search agents");
  });

  it("renders the wordmark inert (no link) when homeHref is omitted", () => {
    render(<AppHeader />);
    expect(screen.queryByTestId(AppHeaderTestId.HomeLink)).toBeNull();
  });

  it("renders the brand mark as a link to homeHref when given", () => {
    render(<AppHeader homeHref="/org" />);
    const link = screen.getByTestId(AppHeaderTestId.HomeLink);
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/org");
    expect(link).toHaveAccessibleName("ZibbyOS");
  });

  it("renders the home link through a custom linkComponent", () => {
    function FakeLink({ href, children, ...rest }: React.ComponentProps<"a"> & { href: string }) {
      return (
        <a data-fake-link href={href} {...rest}>
          {children}
        </a>
      );
    }
    render(<AppHeader homeHref="/org" linkComponent={FakeLink} />);
    expect(screen.getByTestId(AppHeaderTestId.HomeLink)).toHaveAttribute("data-fake-link");
  });

  it("uses a custom homeLabel", () => {
    render(<AppHeader homeHref="/org" homeLabel="Go home" />);
    expect(screen.getByTestId(AppHeaderTestId.HomeLink)).toHaveAccessibleName("Go home");
  });

  it("renders the header landmark", () => {
    render(<AppHeader />);
    expect(screen.getByTestId(AppHeaderTestId.Root)).toHaveRole("banner");
  });
});
