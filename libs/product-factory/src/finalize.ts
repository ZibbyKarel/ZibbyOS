import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { bookDirOf, readJson, writeJson } from "./ctx.ts";
import type { CostLine, Ctx } from "./ctx.ts";
import { KDP_LANGUAGE, buildManifest, readListingPart } from "./publish-manifest.ts";
import { PlanSchema } from "./schemas.ts";

/** Every costs.jsonl under the run dir (all stage folders). */
export function collectCosts(root: string): CostLine[] {
  const lines: CostLine[] = [];
  for (const rel of fs.readdirSync(root, { recursive: true, encoding: "utf8" })) {
    if (rel.split(path.sep).includes("node_modules") || path.basename(rel) !== "costs.jsonl")
      continue;
    for (const l of fs.readFileSync(path.join(root, rel), "utf8").split("\n"))
      if (l.trim()) lines.push(JSON.parse(l) as CostLine);
  }
  return lines;
}

export async function finalize(argv: string[], ctx: Ctx): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { report: { type: "string", default: "book.md" } },
  });
  const listing = positionals[0];
  if (!listing) throw new Error("usage: product-factory finalize <listing.md> [--report book.md]");
  const book = bookDirOf(ctx);
  const plan = PlanSchema.parse(readJson(path.join(book, "plan.json")));
  // A rework pass re-copies: the previous copy inherited the read-only mode of its source.
  fs.rmSync(path.join(book, "listing.md"), { force: true });
  fs.copyFileSync(path.resolve(ctx.cwd, listing), path.join(book, "listing.md"));

  const costs = collectCosts(ctx.env.ZIBBY_RUN_DIR ?? ctx.cwd);
  const total = costs.reduce((s, c) => s + c.costUsd, 0);
  const providers = [...new Set(costs.map((c) => `${c.provider}/${c.model}`))];
  const files = fs
    .readdirSync(book)
    .filter((f) => !f.startsWith("."))
    .sort();
  const created = ctx.env.PF_CREATED_AT ?? new Date().toISOString();

  fs.writeFileSync(
    path.join(book, "README.md"),
    [
      `# ${plan.title}`,
      "",
      plan.subtitle ?? "",
      "",
      `- theme: ${plan.brief.theme}`,
      `- ages: ${plan.brief.targetAge.min}-${plan.brief.targetAge.max}, language: ${plan.brief.language}`,
      `- coloring pages: ${plan.pages.length}, trim ${plan.brief.trim}`,
      `- total production cost: $${total.toFixed(4)}`,
      `- providers: ${providers.join(", ") || "none"}`,
      `- created: ${created}`,
      "",
      "## Files",
      "",
      ...files.map((f) => `- ${f}`),
      "",
      "Images are AI-generated — disclose on KDP.",
      "",
    ].join("\n"),
  );
  const notes: string[] = [];
  let code = 0;
  fs.rmSync(path.join(book, "publish.json"), { force: true });
  try {
    const part = readListingPart(path.join(book, "listing.md"));
    if (!part) notes.push("No ```json block in the listing: publish.json not written.");
    else {
      const pre = readJson(path.join(book, "preflight.json")) as { interiorPages: number };
      const author = ctx.env.PF_AUTHOR ?? "";
      writeJson(
        path.join(book, "publish.json"),
        buildManifest(part, {
          language: KDP_LANGUAGE[plan.brief.language] ?? plan.brief.language,
          trim: plan.brief.trim,
          bleed: false, // the interior pages are exactly trim size (render.ts PAGE_W_PT x PAGE_H_PT)
          pageCount: pre.interiorPages,
          author,
        }),
      );
      notes.push("publish.json written.");
      if (!author.trim())
        notes.push("Warning: author missing: set PF_AUTHOR in the publishing project env.");
    }
  } catch (e) {
    notes.push(`publish manifest invalid: ${(e as Error).message}`);
    code = 1;
  }
  fs.writeFileSync(
    path.resolve(ctx.cwd, values.report),
    `# Book ready\n\n${book}\n\nTotal production cost: $${total.toFixed(4)}\n\n${notes.join("\n")}\n`,
  );
  for (const n of notes) console.log(`finalize: ${n}`);
  console.log(`finalize: ${book}`);
  return code;
}
