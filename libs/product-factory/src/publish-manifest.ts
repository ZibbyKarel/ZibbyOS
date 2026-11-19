import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseArgs } from "node:util";
import { z } from "zod";
import { readJsonArtifact } from "./artifact.ts";
import { bookDirOf } from "./ctx.ts";
import type { Ctx } from "./ctx.ts";

const Level = z.enum(["none", "assisted", "generated"]);

/** Fields the listing agent writes (the fenced json block of its Markdown). Unknown keys are dropped. */
export const ListingPartSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().default(""),
  description: z.string().min(1).max(4000),
  keywords: z.array(z.string().min(1).max(50)).length(7),
  categories: z.array(z.string().min(1)).min(1).max(3),
  readingAge: z
    .strictObject({ min: z.number().int().min(0), max: z.number().int().min(0) })
    .optional(),
  aiDisclosure: z.strictObject({
    text: Level,
    images: Level,
    translations: Level.default("none"),
    tools: z.string().default(""),
  }),
  pricing: z.object({ listPriceUsd: z.number() }),
  coverFinish: z.enum(["glossy", "matte"]).default("glossy"),
  lowContent: z.boolean().default(false),
});
export type ListingPart = z.infer<typeof ListingPartSchema>;

/** Channel-level publish manifest for a KDP paperback; paths in `files` are relative to its folder. */
export const PublishManifestSchema = z
  .strictObject({
    version: z.literal(1),
    channel: z.literal("kdp-paperback"),
    language: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string(),
    author: z.strictObject({ firstName: z.string(), lastName: z.string() }),
    description: z.string().min(1).max(4000),
    keywords: z.array(z.string().min(1).max(50)).length(7),
    categories: z.array(z.string().min(1)).min(1).max(3),
    readingAge: z
      .strictObject({ min: z.number().int().min(0), max: z.number().int().min(0) })
      .optional(),
    adultContent: z.boolean(),
    lowContent: z.boolean(),
    publishingRights: z.enum(["own", "public-domain"]),
    isbn: z.literal("free-kdp"),
    print: z.strictObject({
      ink: z.literal("black-white"),
      paper: z.literal("white"),
      trim: z.string().min(1),
      bleed: z.boolean(),
      coverFinish: z.enum(["glossy", "matte"]),
      pageCount: z.number().int().positive(),
    }),
    files: z.strictObject({ interior: z.string().min(1), cover: z.string().min(1) }),
    aiDisclosure: z.strictObject({
      text: Level,
      images: Level,
      translations: Level,
      tools: z.string(),
    }),
    pricing: z.strictObject({
      marketplace: z.string().min(1),
      listPriceUsd: z.number(),
      expandedDistribution: z.boolean(),
    }),
  })
  .refine((m) => m.title.length + m.subtitle.length <= 200, "title + subtitle must be ≤ 200 chars");
export type PublishManifest = z.infer<typeof PublishManifestSchema>;

/** Facts the tool knows better than the agent. */
export interface BookFacts {
  language: string;
  trim: string;
  bleed: boolean;
  pageCount: number;
  author: string;
}

export const KDP_LANGUAGE: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  cs: "Czech",
};

/** The listing's fenced json block as a listing part, or null when the Markdown has none. */
export function readListingPart(file: string): ListingPart | null {
  if (!/```json/i.test(fs.readFileSync(file, "utf8"))) return null;
  return ListingPartSchema.parse(readJsonArtifact(file));
}

export function buildManifest(l: ListingPart, f: BookFacts): PublishManifest {
  const words = f.author.trim().split(/\s+/).filter(Boolean);
  const lastName = words.length > 1 ? (words.pop() ?? "") : "";
  return PublishManifestSchema.parse({
    version: 1,
    channel: "kdp-paperback",
    language: f.language,
    title: l.title,
    subtitle: l.subtitle,
    author: { firstName: words.join(" "), lastName },
    description: l.description,
    keywords: l.keywords,
    categories: l.categories,
    ...(l.readingAge ? { readingAge: l.readingAge } : {}),
    adultContent: false,
    lowContent: l.lowContent,
    publishingRights: "own",
    isbn: "free-kdp",
    print: {
      ink: "black-white",
      paper: "white",
      trim: f.trim,
      bleed: f.bleed,
      coverFinish: l.coverFinish,
      pageCount: f.pageCount,
    },
    files: { interior: "interior.pdf", cover: "cover.pdf" },
    aiDisclosure: l.aiDisclosure,
    pricing: {
      marketplace: "Amazon.com",
      listPriceUsd: l.pricing.listPriceUsd,
      expandedDistribution: false,
    },
  });
}

const isPdf = (file: string): boolean => {
  if (!fs.existsSync(file)) return false;
  const fd = fs.openSync(file, "r");
  const head = Buffer.alloc(5);
  fs.readSync(fd, head, 0, 5, 0);
  fs.closeSync(fd);
  return head.toString("latin1") === "%PDF-";
};

/**
 * `--from <file>`: the folder is named inside a text file (a run's input, the generation
 * workflow's `book.md`) - the first absolute path in it that holds a publish.json.
 */
const folderNamedIn = (file: string): string => {
  const text = fs.readFileSync(file, "utf8").replaceAll("~/", `${os.homedir()}/`);
  const paths = text.match(/\/[^\n`"'<>]+/g) ?? [];
  const hit = paths
    .map((p) => p.trim().replace(/[.,;)]+$/, ""))
    .find((p) => fs.existsSync(path.join(p, "publish.json")));
  return hit ?? path.resolve(file, "..");
};

/** First deterministic phase of any kdp-publish run: needs only publish.json + the PDFs. */
export async function publishCheck(argv: string[], ctx: Ctx): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { report: { type: "string", default: "publish-check.md" }, from: { type: "string" } },
  });
  const dir = values.from
    ? folderNamedIn(path.resolve(ctx.cwd, values.from))
    : positionals[0]
      ? path.resolve(ctx.cwd, positionals[0])
      : bookDirOf(ctx);
  const problems: string[] = [];
  let summary = "";
  try {
    const parsed = PublishManifestSchema.safeParse(
      JSON.parse(fs.readFileSync(path.join(dir, "publish.json"), "utf8")),
    );
    if (!parsed.success)
      for (const i of parsed.error.issues)
        problems.push(`schema: ${i.path.join(".") || "(root)"}: ${i.message}`);
    else {
      const m = parsed.data;
      summary = `"${m.title}", ${m.print.pageCount} pages, $${m.pricing.listPriceUsd}`;
      for (const [label, rel] of Object.entries(m.files)) {
        const f = path.resolve(dir, rel);
        if (!fs.existsSync(f)) problems.push(`files.${label}: ${rel} does not exist`);
        else if (!isPdf(f)) problems.push(`files.${label}: ${rel} is not a PDF`);
      }
      if (!m.author.firstName.trim() || !m.author.lastName.trim())
        problems.push("author missing: set PF_AUTHOR (First Last) and re-run finalize");
      if (!(m.pricing.listPriceUsd > 0)) problems.push("pricing.listPriceUsd must be > 0");
      if (m.print.pageCount < 24)
        problems.push(`print.pageCount ${m.print.pageCount} < 24 (KDP minimum)`);
    }
  } catch (e) {
    problems.push(`cannot load publish.json in ${dir}: ${(e as Error).message}`);
  }
  const pass = problems.length === 0;
  fs.writeFileSync(
    path.resolve(ctx.cwd, values.report),
    [
      "# Publish check",
      "",
      `- folder: ${dir}`,
      ...(summary ? [`- book: ${summary}`] : []),
      "",
      "## Problems",
      "",
      ...(pass ? ["none"] : problems.map((p) => `- ${p}`)),
      "",
      pass ? "<verdict>pass</verdict>" : "<verdict>gap</verdict>",
      "",
    ].join("\n"),
  );
  for (const p of problems) console.error(`- ${p}`);
  console.log(`publish-check: ${pass ? "passed" : "FAILED"} (${problems.length} problems)`);
  return pass ? 0 : 1;
}
