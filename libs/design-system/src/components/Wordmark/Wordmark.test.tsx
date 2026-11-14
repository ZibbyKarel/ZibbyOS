import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { render } from "../../utils/testRender";
import { Wordmark, WordmarkTestId } from "./Wordmark";

describe("Wordmark", () => {
  it("renders the lowercase lettering with the amber sentence dot", () => {
    render(<Wordmark />);
    expect(screen.getByTestId(WordmarkTestId.Name)).toHaveTextContent("zibby.");
    expect(screen.getByTestId(WordmarkTestId.Dot).className).toContain("text-accent-fg");
  });

  it("keeps the product name as its accessible name", () => {
    render(<Wordmark />);
    const el = screen.getByTestId(WordmarkTestId.Root);
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveAccessibleName("ZibbyOS");
  });

  it("renders an overridden text without the dot", () => {
    render(<Wordmark>ACME CORP</Wordmark>);
    expect(screen.getByTestId(WordmarkTestId.Name)).toHaveTextContent("ACME CORP");
    expect(screen.queryByTestId(WordmarkTestId.Dot)).toBeNull();
    expect(screen.getByTestId(WordmarkTestId.Root)).toHaveAccessibleName("ACME CORP");
  });

  it("renders the splash size", () => {
    render(<Wordmark size="lg" />);
    expect(screen.getByTestId(WordmarkTestId.Name).className).toContain("text-[34px]");
  });

  it("renders no version line by default", () => {
    render(<Wordmark />);
    expect(screen.queryByTestId(WordmarkTestId.Version)).toBeNull();
  });

  it("renders the version as a small second line", () => {
    render(<Wordmark version="v0.2.1" />);
    expect(screen.getByTestId(WordmarkTestId.Version)).toHaveTextContent("v0.2.1");
    expect(screen.getByTestId(WordmarkTestId.Root)).toHaveAccessibleName("ZibbyOS v0.2.1");
  });
});
