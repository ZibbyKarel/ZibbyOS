import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { SectionTrack, SectionTrackTestId } from "./SectionTrack";

const items = [
  { href: "/overview", label: "Dashboard", icon: "grid" as const, active: true, attention: true },
  { href: "/runs", label: "Runs", icon: "play" as const },
];

describe("SectionTrack", () => {
  it("renders a labelled navigation landmark with one link per item", () => {
    render(<SectionTrack items={items} />);
    expect(screen.getByTestId(SectionTrackTestId.Root)).toHaveRole("navigation");
    expect(screen.getByTestId(SectionTrackTestId.Root)).toHaveAccessibleName("Sections");
    expect(screen.getByTestId(`${SectionTrackTestId.Item}-/runs`)).toHaveAttribute("href", "/runs");
  });

  it("marks only the active item as the current page", () => {
    render(<SectionTrack items={items} />);
    expect(screen.getByTestId(`${SectionTrackTestId.Item}-/overview`)).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId(`${SectionTrackTestId.Item}-/runs`)).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows the attention dot only on flagged items", () => {
    render(<SectionTrack items={items} />);
    expect(screen.getAllByTestId(SectionTrackTestId.Attention)).toHaveLength(1);
  });

  it("icon-only items keep an accessible name", () => {
    render(<SectionTrack items={[{ ...items[1]!, iconOnly: true }]} />);
    const link = screen.getByTestId(`${SectionTrackTestId.Item}-/runs`);
    expect(link).toHaveAccessibleName("Runs");
    expect(link).not.toHaveTextContent("Runs");
  });

  it("renders through a custom linkComponent", () => {
    function FakeLink({ href, children, ...rest }: React.ComponentProps<"a"> & { href: string }) {
      return (
        <a data-fake-link href={href} {...rest}>
          {children}
        </a>
      );
    }
    render(<SectionTrack items={items} linkComponent={FakeLink} />);
    expect(screen.getByTestId(`${SectionTrackTestId.Item}-/runs`)).toHaveAttribute(
      "data-fake-link",
    );
  });
});
