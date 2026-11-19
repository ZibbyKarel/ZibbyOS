import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ctx } from "./ctx.ts";
import { finalize } from "./finalize.ts";
import { planCheck } from "./plan-check.ts";
import { PublishManifestSchema, publishCheck } from "./publish-manifest.ts";
import { fixture, tmpCtx } from "./testkit.ts";

vi.spyOn(console, "log").mockImplementation(() => undefined);
vi.spyOn(console, "error").mockImplementation(() => undefined);

const part = {
  title: "Farm Friends",
  subtitle: "A Coloring Book",
  description: "Thirty pages of farm animals.",
  keywords: ["a", "b", "c", "d", "e", "f", "g"],
  categories: ["Juvenile Nonfiction > Activity Books > Coloring"],
  readingAge: { min: 3, max: 5 },
  aiDisclosure: { text: "assisted", images: "generated", tools: "Flux, Claude" },
  pricing: { listPriceUsd: 7.99 },
};
const listing = (p: unknown): string =>
  `# Listing\n\ntext\n\n\`\`\`json\n${JSON.stringify(p)}\n\`\`\`\n`;

let ctx: Ctx;
let book: string;
beforeEach(async () => {
  ctx = tmpCtx({ PF_AUTHOR: "Jane Q Doe" });
  expect(await planCheck([fixture("farm-4", "content-plan.md")], ctx)).toBe(0);
  book = path.join(ctx.cwd, "book");
  fs.writeFileSync(path.join(book, "preflight.json"), JSON.stringify({ interiorPages: 30 }));
  for (const f of ["interior.pdf", "cover.pdf"]) fs.writeFileSync(path.join(book, f), "%PDF-1.7\n");
});
const run = (text: string, c: Ctx = ctx): Promise<number> => {
  fs.writeFileSync(path.join(c.cwd, "listing.md"), text);
  return finalize([path.join(c.cwd, "listing.md")], c);
};

describe("finalize publish.json", () => {
  it("merges the listing block with tool-owned facts", async () => {
    expect(await run(listing({ ...part, print: { pageCount: 999 }, author: "x" }))).toBe(0);
    const m = PublishManifestSchema.parse(
      JSON.parse(fs.readFileSync(`${book}/publish.json`, "utf8")),
    );
    expect(m.print).toMatchObject({
      pageCount: 30,
      trim: "8.5x11",
      bleed: false,
      coverFinish: "glossy",
    });
    expect(m.author).toEqual({ firstName: "Jane Q", lastName: "Doe" });
    expect(m.language).toBe("English");
    expect(m.files).toEqual({ interior: "interior.pdf", cover: "cover.pdf" });
  });

  it("warns on a missing author and keeps old behaviour without a json block", async () => {
    ctx.env.PF_AUTHOR = "";
    expect(await run(listing(part))).toBe(0);
    expect(fs.readFileSync(path.join(ctx.cwd, "book.md"), "utf8")).toMatch(/author missing/);
    expect(await run("# plain\n")).toBe(0);
    expect(fs.existsSync(`${book}/publish.json`)).toBe(false);
    expect(fs.readFileSync(path.join(ctx.cwd, "book.md"), "utf8")).toMatch(
      /publish.json not written/,
    );
  });
});

describe("publish-check", () => {
  it("passes a complete folder and fails on gaps", async () => {
    await run(listing(part));
    expect(await publishCheck([book], ctx)).toBe(0);
    expect(fs.readFileSync(path.join(ctx.cwd, "publish-check.md"), "utf8")).toContain(
      "<verdict>pass</verdict>",
    );

    fs.writeFileSync(`${book}/cover.pdf`, "nope");
    expect(await publishCheck([book], ctx)).toBe(1);
    expect(fs.readFileSync(path.join(ctx.cwd, "publish-check.md"), "utf8")).toMatch(
      /cover.*not a PDF[\s\S]*gap/,
    );

    ctx.env.PF_AUTHOR = "";
    await run(listing(part));
    expect(await publishCheck([book], ctx)).toBe(1);
    expect(fs.readFileSync(path.join(ctx.cwd, "publish-check.md"), "utf8")).toMatch(
      /author missing/,
    );
  });
});
