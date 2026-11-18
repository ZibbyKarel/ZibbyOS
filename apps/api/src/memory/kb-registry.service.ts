import { Injectable, Logger } from "@nestjs/common";
import {
  type KnowledgeBaseEntry,
  type KnowledgeBaseRegistry,
  KnowledgeBaseRegistrySchema,
} from "@zibby/contracts";
import { withPathLock } from "../shared/file-storage/file-lock";
import { NoteNotFoundError, VaultService } from "./vault.service";

/** Registry note id (`knowledge/knowledge-bases.md`) — the mozek's list of connected KBs. */
export const KB_REGISTRY_ID = "knowledge-bases";

const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** Generated, human-readable view of the entries (the frontmatter `kbs:` is the truth). */
function renderBody(kbs: KnowledgeBaseEntry[]): string {
  const rows = kbs.map((k) =>
    [k.id, k.name, k.description, k.path, k.teamId ?? "", k.domain].map(cell).join(" | "),
  );
  return [
    "Connected knowledge bases. Generated from the frontmatter `kbs:` — edit that, not this table.",
    "Read a KB's `AGENTS.md` before using it.",
    "",
    "| id | name | description | path | team | domain |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r} |`),
    "",
  ].join("\n");
}

/**
 * The mozek's registry of connected knowledge bases, stored as the brain note
 * `knowledge/knowledge-bases.md`. Reads are fail-safe (missing/invalid → `[]`, never
 * throws); writes go through {@link VaultService} (stamps `updated`, atomic, vault-log).
 */
@Injectable()
export class KbRegistryService {
  private readonly logger = new Logger(KbRegistryService.name);

  constructor(private readonly vault: VaultService) {}

  async list(): Promise<KnowledgeBaseEntry[]> {
    return (await this.load()).kbs;
  }

  private async load(): Promise<{
    kbs: KnowledgeBaseEntry[];
    state: "missing" | "ok" | "invalid";
  }> {
    let frontmatter: Record<string, unknown>;
    try {
      frontmatter = (await this.vault.note(KB_REGISTRY_ID)).frontmatter;
    } catch (e) {
      // A missing registry is the normal first-run state — silent. Anything else is a warning.
      if (e instanceof NoteNotFoundError) return { kbs: [], state: "missing" };
      this.logger.warn(`KB registry unreadable: ${String(e)}`);
      return { kbs: [], state: "invalid" };
    }
    const parsed = KnowledgeBaseRegistrySchema.safeParse(frontmatter);
    if (!parsed.success) {
      this.logger.warn(`KB registry invalid, treating as empty: ${parsed.error.message}`);
      return { kbs: [], state: "invalid" };
    }
    return { kbs: parsed.data.kbs, state: "ok" };
  }

  async get(id: string): Promise<KnowledgeBaseEntry | undefined> {
    return (await this.list()).find((k) => k.id === id);
  }

  async forTeam(teamId: string): Promise<KnowledgeBaseEntry | undefined> {
    return (await this.list()).find((k) => k.teamId === teamId);
  }

  /** Insert or replace the entry with the same `id`. */
  async upsert(entry: KnowledgeBaseEntry): Promise<void> {
    await this.mutate((kbs) => [...kbs.filter((k) => k.id !== entry.id), entry]);
  }

  /** Drop every entry bound to `teamId` (no write when there is none). */
  async removeForTeam(teamId: string): Promise<void> {
    await this.mutate((kbs) => kbs.filter((k) => k.teamId !== teamId));
  }

  private async mutate(change: (kbs: KnowledgeBaseEntry[]) => KnowledgeBaseEntry[]): Promise<void> {
    await withPathLock(`note:${KB_REGISTRY_ID}`, async () => {
      const { kbs: before, state } = await this.load();
      // Never clobber a hand-edited registry we could not parse.
      if (state === "invalid")
        throw new Error("KB registry note is invalid; fix it before writing");
      const kbs = change(before);
      if (kbs.length === before.length && kbs.every((k, i) => k === before[i])) return;
      const registry: KnowledgeBaseRegistry = KnowledgeBaseRegistrySchema.parse({ kbs });
      const body = renderBody(registry.kbs);
      // JSON round-trip drops `undefined` keys, which YAML cannot dump.
      const frontmatter = JSON.parse(JSON.stringify(registry)) as Record<string, unknown>;
      if (state === "ok") {
        await this.vault.updateNote(KB_REGISTRY_ID, { frontmatter, body });
      } else {
        await this.vault.createNote({
          id: KB_REGISTRY_ID,
          tier: "knowledge",
          title: "Knowledge bases",
          body,
          frontmatter,
        });
      }
    });
  }
}
