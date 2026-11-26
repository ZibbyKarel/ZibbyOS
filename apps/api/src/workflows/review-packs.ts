import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Logger } from "@nestjs/common";
import matter from "gray-matter";

/** Vault folder (non-recursive) holding the hand-curated review rule packs. */
export const REVIEW_PACKS_DIR = path.join("knowledge", "review-packs");
/** Stage-sandbox folder the matching packs are copied into. */
export const REVIEW_RULES_DIR = "review-rules";

const RULE_ID = /^- \*\*([A-Z]+-\d+)\*\*/gm;
// `index` would clash with INDEX.md on a case-insensitive filesystem.
const SAFE_LANE = /^(?!index$)[a-z0-9-]+$/;
const logger = new Logger("ReviewPacks");

/** One parsed `type: review-pack` note. Every frontmatter field is type-guarded data. */
export interface ReviewPack {
  type: unknown;
  company?: string;
  project?: string;
  lane: string;
  title: string;
  order?: number;
  paths: string[];
  runs?: string;
  source?: string;
  snapshot?: string;
  body: string;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0
    ? v
    : v instanceof Date
      ? v.toISOString().slice(0, 10)
      : undefined;

function toPack(data: Record<string, unknown>, body: string, fallbackTitle: string): ReviewPack {
  return {
    type: data.type,
    ...(str(data.company) ? { company: str(data.company) } : {}),
    ...(str(data.project) ? { project: str(data.project) } : {}),
    lane: str(data.lane) ?? "",
    title: str(data.title) ?? fallbackTitle,
    ...(typeof data.order === "number" && Number.isFinite(data.order) ? { order: data.order } : {}),
    paths: Array.isArray(data.paths)
      ? data.paths.filter((p): p is string => typeof p === "string")
      : [],
    ...(str(data.runs) ? { runs: str(data.runs) } : {}),
    ...(str(data.source) ? { source: str(data.source) } : {}),
    ...(str(data.snapshot) ? { snapshot: str(data.snapshot) } : {}),
    body: body.trim(),
  };
}

/**
 * The packs that apply to a run: `type: review-pack`, at least one scope key
 * (`company`/`project`), and EVERY declared scope key equal to the run's value — a
 * company-only pack covers all of that company's projects, company+project only that
 * project. Sorted by `order` (missing last), then `lane`. Pure.
 */
export function selectReviewPacks(
  packs: readonly ReviewPack[],
  run: { projectId: string; companyId?: string },
): ReviewPack[] {
  return packs
    .filter(
      (p) =>
        p.type === "review-pack" &&
        (p.company !== undefined || p.project !== undefined) &&
        (p.company === undefined || p.company === run.companyId) &&
        (p.project === undefined || p.project === run.projectId),
    )
    .sort(
      (a, b) =>
        (a.order ?? Infinity) - (b.order ?? Infinity) ||
        (a.lane < b.lane ? -1 : a.lane > b.lane ? 1 : 0),
    );
}

const ruleIdsOf = (body: string): string[] => [...body.matchAll(RULE_ID)].map((m) => m[1]!);
const cell = (s: string | undefined): string =>
  (s ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

/**
 * Copy the packs matching this run from `<vaultDir>/knowledge/review-packs/` into
 * `<stageDir>/review-rules/`: one `<lane>.md` per lane (pack body only — two packs on
 * the same lane, e.g. company-wide + project, are appended into one file), an
 * `INDEX.md` table and the `offered.json` audit manifest. A previous copy is removed
 * first so a retry starts clean. Fail-open: no folder, no match or any error → null.
 * Note content is only ever copied as data.
 */
export async function stageReviewPacks(opts: {
  vaultDir: string;
  stageDir: string;
  projectId: string;
  companyId?: string;
}): Promise<{ dirAbs: string; packs: ReviewPack[] } | null> {
  try {
    const src = path.join(opts.vaultDir, REVIEW_PACKS_DIR);
    const names = await fs.readdir(src).catch(() => null);
    if (!names) return null;
    const all: ReviewPack[] = [];
    for (const name of names.filter((n) => n.endsWith(".md"))) {
      const raw = await fs.readFile(path.join(src, name), "utf8").catch(() => null);
      if (raw === null) continue;
      try {
        const parsed = matter(raw);
        all.push(
          toPack(parsed.data as Record<string, unknown>, parsed.content, name.replace(/\.md$/, "")),
        );
      } catch {
        // Broken frontmatter in one note never sinks the others.
      }
    }
    const packs = selectReviewPacks(all, opts).filter((p) => SAFE_LANE.test(p.lane.toLowerCase()));
    if (packs.length === 0) return null;

    const dirAbs = path.join(opts.stageDir, REVIEW_RULES_DIR);
    await fs.rm(dirAbs, { recursive: true, force: true });
    await fs.mkdir(dirAbs, { recursive: true });
    const bodies = new Map<string, string[]>();
    for (const p of packs) {
      const file = `${p.lane.toLowerCase()}.md`;
      bodies.set(file, [...(bodies.get(file) ?? []), p.body]);
    }
    for (const [file, parts] of bodies) {
      await fs.writeFile(path.join(dirAbs, file), `${parts.join("\n\n")}\n`, "utf8");
    }
    const rows = packs.map((p) => {
      const file = `${p.lane.toLowerCase()}.md`;
      return `| ${cell(p.lane)} | ${cell(p.title)} | ${file} | ${ruleIdsOf(p.body).length} | ${cell(p.paths.join(", "))} | ${cell(p.runs)} |`;
    });
    await fs.writeFile(
      path.join(dirAbs, "INDEX.md"),
      [
        "# Review rule packs",
        "",
        "| Lane | Title | File | Rules | Paths | Runs |",
        "| --- | --- | --- | --- | --- | --- |",
        ...rows,
        "",
      ].join("\n"),
      "utf8",
    );
    const offered = {
      stagedAt: new Date().toISOString(),
      projectId: opts.projectId,
      companyId: opts.companyId ?? null,
      packs: packs.map((p) => ({
        lane: p.lane,
        title: p.title,
        file: `${p.lane.toLowerCase()}.md`,
        source: p.source ?? null,
        snapshot: p.snapshot ?? null,
        paths: p.paths,
        ruleIds: ruleIdsOf(p.body),
      })),
    };
    await fs.writeFile(
      path.join(dirAbs, "offered.json"),
      `${JSON.stringify(offered, null, 2)}\n`,
      "utf8",
    );
    return { dirAbs, packs };
  } catch (error) {
    logger.warn(`review packs not staged, continuing without them: ${String(error)}`);
    return null;
  }
}
