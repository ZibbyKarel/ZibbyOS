import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown, MarkdownTestId } from "./Markdown";

describe("Markdown", () => {
  it("renders a heading as a real heading element", () => {
    render(<Markdown source="# Hello" />);
    const heading = screen.getByTestId(MarkdownTestId.Heading);
    expect(heading).toHaveRole("heading");
    expect(heading).toHaveAccessibleName("Hello");
  });

  it("renders list items", () => {
    render(<Markdown source={"- item one\n- item two"} />);
    const items = screen.getAllByTestId(MarkdownTestId.ListItem);
    expect(items).toHaveLength(2);
    items.forEach((item) => expect(item).toHaveRole("listitem"));
  });

  it("renders strong emphasis", () => {
    render(<Markdown source="**bold**" />);
    expect(screen.getByTestId(MarkdownTestId.Strong)).toHaveTextContent("bold");
  });

  it("allowImage: a disallowed image renders as a link, an allowed one as an image", () => {
    render(
      <Markdown
        allowImage={(src) => src.startsWith("https://ok.test/")}
        source={"![shot](https://ok.test/a.png) ![pixel](https://evil.test/p.png)"}
      />,
    );
    const root = screen.getByTestId(MarkdownTestId.Root);
    const images = root.getElementsByTagName("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", "https://ok.test/a.png");
    const link = screen.getByTestId(MarkdownTestId.BlockedImage);
    expect(link).toHaveAttribute("href", "https://evil.test/p.png");
    expect(link).toHaveTextContent("pixel");
  });

  it("exposes the root testid", () => {
    render(<Markdown source="text" />);
    const root = screen.getByTestId(MarkdownTestId.Root);
    expect(root).toBeInTheDocument();
    expect(root).toHaveTextContent("text");
  });

  describe("escapeHtml", () => {
    const source =
      "Wrap it in <Suspense> and a <CustomTag> here.\n\n```tsx\nconst x = <div>hi</div>;\n```";

    it("parses raw HTML by default (stray tags become empty elements, swallowed)", () => {
      render(<Markdown source={source} />);
      // The bare tags are interpreted as HTML and rendered as empty elements,
      // so their text is lost, the pre-existing behaviour this opt-in fixes.
      expect(screen.getByTestId(MarkdownTestId.Root)).not.toHaveTextContent("<Suspense>");
    });

    it("renders stray tags as literal text when escapeHtml is set", () => {
      render(<Markdown escapeHtml source={source} />);
      const root = screen.getByTestId(MarkdownTestId.Root);
      expect(root).toHaveTextContent("<Suspense>");
      expect(root).toHaveTextContent("<CustomTag>");
    });

    it("renders a safe <img> (block and inline) as an image, dropping every other attribute", () => {
      const ok = (src: string) => src.startsWith("https://ok.test/");
      render(
        <Markdown
          escapeHtml
          allowImage={ok}
          source={
            '<img width="1507" height="1258" alt="shot" src="https://ok.test/a.png" onerror="x()" style="x:y" />\n\ntext <img src="https://ok.test/b.png" alt="b"> more'
          }
        />,
      );
      const root = screen.getByTestId(MarkdownTestId.Root);
      const images = root.getElementsByTagName("img");
      expect(images).toHaveLength(2);
      expect(images[0]).toHaveAttribute("width", "1507");
      expect(images[0]).toHaveAttribute("height", "1258");
      expect(images[0]).toHaveAttribute("alt", "shot");
      expect(images[0]).not.toHaveAttribute("onerror");
      expect(images[0]).not.toHaveAttribute("style");
      expect(root).not.toHaveTextContent("<img");
    });

    it("keeps an <img> with a non-http(s) src, and any other tag, as literal text", () => {
      render(
        <Markdown escapeHtml source={'<img src="javascript:alert(1)">\n\n<script>x</script>'} />,
      );
      const root = screen.getByTestId(MarkdownTestId.Root);
      expect(root.getElementsByTagName("img")).toHaveLength(0);
      expect(root).toHaveTextContent("<img");
      expect(root).toHaveTextContent("<script>");
    });

    it("an <img> the allowImage guard rejects renders as a link, not a request", () => {
      render(
        <Markdown
          escapeHtml
          allowImage={() => false}
          source={'<img src="https://evil.test/p.png" alt="p">'}
        />,
      );
      const root = screen.getByTestId(MarkdownTestId.Root);
      expect(root.getElementsByTagName("img")).toHaveLength(0);
      expect(screen.getByTestId(MarkdownTestId.BlockedImage)).toHaveAttribute(
        "href",
        "https://evil.test/p.png",
      );
    });

    it("still renders a fenced code block (and its angle brackets) when escapeHtml is set", () => {
      render(<Markdown escapeHtml source={source} />);
      expect(screen.getByTestId(MarkdownTestId.CodeBlock)).toHaveTextContent(
        "const x = <div>hi</div>;",
      );
    });

    it("still renders markdown structure (lists) when escapeHtml is set", () => {
      render(<Markdown escapeHtml source={"- one\n- two"} />);
      const items = screen.getAllByTestId(MarkdownTestId.ListItem);
      expect(items).toHaveLength(2);
      items.forEach((item) => expect(item).toHaveRole("listitem"));
    });
  });

  describe("highlight", () => {
    const mentions = (text: string) =>
      [...text.matchAll(/@Bob/g)].map((m) => ({
        start: m.index ?? 0,
        end: (m.index ?? 0) + 4,
        tone: "accent" as const,
      }));

    it("marks the spans the highlight callback returns", () => {
      render(<Markdown highlight={mentions} source={"ask @Bob **now**"} variant="prose" />);
      const marks = screen.getAllByTestId(MarkdownTestId.Mark);
      expect(marks).toHaveLength(1);
      expect(marks[0]).toHaveTextContent("@Bob");
      expect(marks[0]).toHaveClass("bg-accent/[0.14]");
    });

    it("never marks inside inline or fenced code", () => {
      render(<Markdown highlight={mentions} source={"`@Bob`\n\n```\n@Bob\n```"} />);
      expect(screen.queryAllByTestId(MarkdownTestId.Mark)).toHaveLength(0);
    });
  });

  it("adds the compact class only when asked", () => {
    const { rerender } = render(<Markdown source="a" />);
    expect(screen.getByTestId(MarkdownTestId.Root)).not.toHaveClass("md-compact");
    rerender(<Markdown compact source="a" />);
    expect(screen.getByTestId(MarkdownTestId.Root)).toHaveClass("md-compact");
  });

  it("prose: app-relative links stay in the tab, external ones open a new one", () => {
    render(<Markdown source="[run](/activity/runs/r1) [ext](https://x.cz)" variant="prose" />);
    const rel = screen.getByRole("link", { name: "run" });
    expect(rel).toHaveAttribute("href", "/activity/runs/r1");
    expect(rel).not.toHaveAttribute("target");
    expect(screen.getByRole("link", { name: "ext" })).toHaveAttribute("target", "_blank");
  });
});
