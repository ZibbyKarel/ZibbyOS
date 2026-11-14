import type { ReactNode } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { BriefingHero, BriefingHeroTestId } from "./BriefingHero";

const counters = [
  { id: "needs", label: "Needs you", value: "03", tone: "accent" as const, href: "/a" },
  { id: "failing", label: "Failing", value: "01", tone: "error" as const },
  { id: "running", label: "Running", value: "00" },
];

describe("BriefingHero", () => {
  it("renders title, lead, eyebrow and the counters", () => {
    render(
      <BriefingHero
        ariaLabel="Briefing"
        counters={counters}
        eyebrow="Sat 14 Nov"
        lead="Three things wait on you."
        title="Good evening."
      />,
    );
    expect(screen.getByTestId(BriefingHeroTestId.Root)).toHaveAccessibleName("Briefing");
    expect(screen.getByTestId(BriefingHeroTestId.Title)).toHaveTextContent("Good evening.");
    expect(screen.getByTestId(BriefingHeroTestId.Lead)).toHaveTextContent("Three things");
    expect(screen.getByTestId(BriefingHeroTestId.Eyebrow)).toHaveTextContent("Sat 14 Nov");
    expect(screen.getByTestId(`${BriefingHeroTestId.Value}-needs`)).toHaveTextContent("03");
    expect(screen.getByTestId(`${BriefingHeroTestId.Value}-needs`)).toHaveClass("text-display");
    expect(screen.getByTestId(`${BriefingHeroTestId.Value}-needs`)).toHaveClass("text-accent-fg");
    expect(screen.getByTestId(`${BriefingHeroTestId.Value}-failing`)).toHaveClass("text-state-err");
  });

  it("empty state: title and numerals only", () => {
    render(<BriefingHero counters={counters} title="A quiet day." />);
    expect(screen.queryByTestId(BriefingHeroTestId.Lead)).toBeNull();
    expect(screen.queryByTestId(BriefingHeroTestId.Eyebrow)).toBeNull();
    expect(screen.getByTestId(`${BriefingHeroTestId.Counter}-running`)).toBeInTheDocument();
  });

  it("slim drops the eyebrow; phone scrolls the counters", () => {
    const { rerender } = render(
      <BriefingHero counters={counters} eyebrow="x" title="t" variant="slim" />,
    );
    expect(screen.queryByTestId(BriefingHeroTestId.Eyebrow)).toBeNull();
    rerender(<BriefingHero counters={counters} title="t" variant="phone" />);
    expect(screen.getByTestId(BriefingHeroTestId.Root)).toHaveAttribute("data-variant", "phone");
    expect(screen.getByTestId(BriefingHeroTestId.Counters)).toHaveClass("overflow-x-auto");
  });

  it("links a counter with an href through the linkComponent", () => {
    const FakeLink = ({ href, children, ...rest }: { href: string; children?: ReactNode }) => (
      <a data-fake="1" href={href} {...rest}>
        {children}
      </a>
    );
    render(<BriefingHero counters={counters} linkComponent={FakeLink} title="t" />);
    const link = screen.getByTestId(`${BriefingHeroTestId.Link}-needs`);
    expect(link).toHaveAttribute("href", "/a");
    expect(link).toHaveAttribute("data-fake", "1");
    expect(link).toHaveAccessibleName("03 Needs you");
    expect(screen.queryByTestId(`${BriefingHeroTestId.Link}-failing`)).toBeNull();
  });
});
