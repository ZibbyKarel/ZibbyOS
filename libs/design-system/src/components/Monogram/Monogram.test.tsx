import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Monogram, MonogramTestId, monogramHue, monogramInitials } from "./Monogram";

describe("Monogram", () => {
  it("derives initials", () => {
    expect(monogramInitials("Architekt")).toBe("Ar");
    expect(monogramInitials("Karel Zíbar")).toBe("KZ");
  });
  it("is deterministic per name", () => {
    expect(monogramHue("Kodér")).toBe(monogramHue("Kodér"));
  });
  it("renders the initials at the given size", () => {
    render(<Monogram name="Tester" size={40} />);
    const el = screen.getByTestId(MonogramTestId.Root);
    expect(el).toHaveTextContent("Te");
    expect(el).toHaveStyle({ width: "40px" });
  });
});
