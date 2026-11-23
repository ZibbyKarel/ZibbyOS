import { DuplicateNoteError, type VaultService } from "./vault.service";

/** The MOC that tells the brain where run deliverables live (root + one note per delivery). */
export const GENERATED_ARTIFACTS_MOC = "generated-artifacts";

const ROOT_LINE = /^Root: .*$/m;

/** A vault-safe note id fragment: lowercase alphanumerics and dashes. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mocBody(root: string): string {
  return [
    "# Generated artifacts",
    "",
    `Root: \`${root}\``,
    "",
    "Everything ZIBBY produces as files lands under this root (Settings → Machine). Each delivery",
    "below is a note with the exact `path`; earlier deliveries stay where they were put when the",
    "root changes. To find a file, read the note, then open its `path`.",
    "",
  ].join("\n");
}

/**
 * Make sure the brain's artifacts MOC exists and names the CURRENT generated root.
 * Idempotent; the note list below the header is never touched.
 */
export async function syncGeneratedRootNote(vault: VaultService, root: string): Promise<void> {
  try {
    await vault.createNote({
      id: GENERATED_ARTIFACTS_MOC,
      tier: "knowledge",
      title: "Generated artifacts",
      frontmatter: { type: "moc" },
      body: mocBody(root),
    });
  } catch (error) {
    if (!(error instanceof DuplicateNoteError)) throw error;
    const existing = (await vault.note(GENERATED_ARTIFACTS_MOC)).body ?? "";
    const line = `Root: \`${root}\``;
    if (ROOT_LINE.test(existing)) {
      if (existing.match(ROOT_LINE)?.[0] === line) return;
      await vault.updateNote(GENERATED_ARTIFACTS_MOC, { body: existing.replace(ROOT_LINE, line) });
    } else {
      await vault.updateNote(GENERATED_ARTIFACTS_MOC, { body: `${line}\n\n${existing}` });
    }
  }
}

export interface GeneratedArtifactInput {
  /** The generated-artifacts root in force at delivery time. */
  root: string;
  /** Absolute path of the delivered folder or file. */
  path: string;
  kind: "folder" | "file";
  workflowId?: string;
  /** Run (or task) id the delivery belongs to. */
  runId: string;
  /** The run-relative source name (`book`, `report.md`). */
  from: string;
}

/**
 * Leave a durable, searchable pointer in the brain for one delivered artifact: a note
 * `generated-<run>-<from>` carrying the absolute `path`, linked from the
 * `generated-artifacts` MOC. Callers treat this as best-effort — a vault hiccup must
 * never fail an already-delivered artifact.
 */
export async function recordGeneratedArtifactNote(
  vault: VaultService,
  input: GeneratedArtifactInput,
): Promise<string> {
  await syncGeneratedRootNote(vault, input.root);
  const id = `generated-${slug(input.runId)}-${slug(input.from)}`;
  const title = `${input.workflowId ?? "run"} → ${input.from}`;
  const frontmatter: Record<string, unknown> = {
    type: "artifact",
    kind: input.kind,
    ...(input.workflowId ? { workflow: input.workflowId } : {}),
    run: input.runId,
    path: input.path,
    root: input.root,
    delivered: new Date().toISOString(),
  };
  const body = `# ${title}\n\n- Path: \`${input.path}\`\n- Kind: ${input.kind}\n- Run: ${input.runId}\n- Generated root at delivery: \`${input.root}\`\n\nBack to [[${GENERATED_ARTIFACTS_MOC}]].\n`;
  try {
    await vault.createNote({ id, tier: "knowledge", title, body, frontmatter });
  } catch (error) {
    if (!(error instanceof DuplicateNoteError)) throw error;
    await vault.updateNote(id, { title, body, frontmatter });
  }
  await vault.updateIndex(GENERATED_ARTIFACTS_MOC, id, input.path);
  return id;
}
