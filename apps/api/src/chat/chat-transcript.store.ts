import { promises as fs } from "node:fs";
import * as path from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  type AiEngine,
  type ChatConversationSummary,
  type ChatMessage,
  ChatMessageSchema,
  type ChatTranscript,
} from "@zibby/contracts";
import {
  collisionResistantId,
  ensureDir,
  fileExists,
  safeJson,
  writeFileAtomic,
} from "../shared/file-storage";
import type { AttachmentSetRefProvider } from "../tasks/attachment-set-ref-provider";

/** DI token for the directory holding per-conversation chat transcripts. */
export const CHAT_DIR = "CHAT_DIR";

/** Longest title a history row carries (the first operator turn, truncated). */
const TITLE_MAX = 80;

/** Directory (inside the chat dir) soft-deleted / cleared conversations are moved to. */
export const CHAT_TRASH_DIRNAME = ".trash";

/** Longest search-hit excerpt a history row carries (≈ — an ellipsis may add a char or two). */
const SNIPPET_MAX = 140;

/**
 * Strict conversation id: ids are `conv_<ms>_<hex>`, but tests/clients may use other
 * simple slugs. No dots, slashes or leading dashes — so an id can never traverse out of
 * the chat dir nor collide with `.trash` / `active.json`.
 */
const CONVERSATION_ID_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$/;

/** True when `id` is safe to splice into a file name under the chat dir. */
export function isValidConversationId(id: unknown): id is string {
  return typeof id === "string" && CONVERSATION_ID_RE.test(id);
}

function assertValidId(conversationId: string): void {
  if (!isValidConversationId(conversationId)) {
    throw new Error(`Invalid chat conversation id: ${JSON.stringify(conversationId)}`);
  }
}

function ignoreMissing(error: unknown): void {
  if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") throw error;
}

/** Collapse all whitespace (incl. newlines) so titles/snippets are single-line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** ≈{@link SNIPPET_MAX}-char single-line excerpt of `text` centred on the first `needle` hit. */
function makeSnippet(text: string, needle: string): string {
  const flat = oneLine(text);
  const hit = Math.max(0, flat.toLowerCase().indexOf(needle));
  if (flat.length <= SNIPPET_MAX) return flat;
  let start = Math.max(0, hit - Math.floor((SNIPPET_MAX - needle.length) / 2));
  const end = Math.min(flat.length, start + SNIPPET_MAX);
  start = Math.max(0, end - SNIPPET_MAX);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

/** Sidecar meta for one conversation: the threaded `claude` session id lives here. */
interface ConversationMeta {
  conversationId: string;
  sessionId: string | null;
  /** A24 — the engine `sessionId` belongs to; absent = `claude` (meta from before engines). */
  sessionEngine?: AiEngine;
  /** Operator-chosen title (rename); absent = derived from the first operator turn. */
  title?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Files-are-the-source-of-truth persistence for chat. Each conversation is an
 * append-only `<id>.jsonl` of {@link ChatMessage}s (the durable transcript) plus a
 * `<id>.meta.json` sidecar holding the `claude` CLI `sessionId` threaded across
 * turns via `--resume`. `active.json` points at the single ongoing thread (MVP is
 * one conversation; the id seam is here so branches/threads can land later).
 *
 * Append uses O_APPEND single writes (the activity-log precedent), never a
 * read-modify-rename, so concurrent turns can't clobber the transcript. Reads are
 * line-tolerant: a torn final line after a crash costs one message, not the thread.
 */
@Injectable()
export class ChatTranscriptStore implements AttachmentSetRefProvider {
  private readonly logger = new Logger(ChatTranscriptStore.name);

  constructor(@Inject(CHAT_DIR) private readonly dir: string) {}

  /**
   * D-020 — every attachment-set id a persisted chat message references (see
   * `ChatMessageSchema.attachmentSetId`), across every conversation, so the
   * scheduler's 24h orphan sweep (`TaskSchedulerService.sweepOrphanAttachmentSets`,
   * via `AttachmentSetRefsModule`) never deletes a set a chat turn still points at.
   * Never throws (both underlying reads already degrade to `[]`/`null` on failure).
   */
  async referencedSetIds(): Promise<string[]> {
    const ids = new Set<string>();
    for (const conversationId of await this.listConversationIds()) {
      const messages = await this.readMessages(conversationId);
      for (const message of messages) {
        if (message.attachmentSetId) ids.add(message.attachmentSetId);
      }
    }
    return [...ids];
  }

  /**
   * Resolve the conversation to write to: an explicit id, else the active thread,
   * else a freshly created one (which becomes active). Always returns an id whose
   * meta sidecar exists.
   */
  async ensureConversation(conversationId?: string, now: Date = new Date()): Promise<string> {
    if (conversationId) {
      await this.ensureMeta(conversationId, now);
      return conversationId;
    }
    const active = await this.readActive();
    if (active) return active;
    const created = collisionResistantId("conv");
    await this.ensureMeta(created, now);
    await this.setActive(created);
    return created;
  }

  async appendMessage(conversationId: string, message: ChatMessage): Promise<void> {
    await ensureDir(this.dir);
    await fs.appendFile(this.fileFor(conversationId), `${JSON.stringify(message)}\n`, "utf8");
  }

  async readTranscript(conversationId: string): Promise<ChatTranscript> {
    const meta = await this.readMeta(conversationId);
    return {
      conversationId,
      sessionId: meta?.sessionId ?? null,
      ...(meta?.sessionEngine ? { sessionEngine: meta.sessionEngine } : {}),
      messages: await this.readMessages(conversationId),
    };
  }

  async getSessionId(conversationId: string): Promise<string | null> {
    return (await this.getSession(conversationId)).sessionId;
  }

  /** The threaded session id and the engine it belongs to (`claude` when unrecorded). */
  async getSession(
    conversationId: string,
  ): Promise<{ sessionId: string | null; engine: AiEngine }> {
    const meta = await this.readMeta(conversationId);
    return { sessionId: meta?.sessionId ?? null, engine: meta?.sessionEngine ?? "claude" };
  }

  async setSessionId(
    conversationId: string,
    sessionId: string,
    now: Date = new Date(),
    engine: AiEngine = "claude",
  ): Promise<void> {
    const meta = (await this.readMeta(conversationId)) ?? this.freshMeta(conversationId, now);
    await this.writeMeta({
      ...meta,
      sessionId,
      sessionEngine: engine,
      updatedAt: now.toISOString(),
    });
  }

  /**
   * Past conversations for the history sidebar, newest first. Empty threads are
   * skipped; `q` keeps only threads whose title or some message's text contains it
   * (case-insensitive, whitespace-normalised) and adds a `snippet` of the first
   * matching message (omitted when only the title matched).
   */
  async listConversations(q?: string): Promise<ChatConversationSummary[]> {
    // ponytail: reads every transcript per call — fine for one operator's history,
    // add a summary index if it grows to thousands of threads.
    const needle = q ? oneLine(q).toLowerCase() : "";
    const out: ChatConversationSummary[] = [];
    for (const conversationId of await this.listConversationIds()) {
      const summary = await this.summarize(conversationId, needle);
      if (summary && summary.messageCount > 0) out.push(summary);
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /**
   * One history row. With a non-empty `needle`, returns null when nothing matches.
   * A conversation without messages yields `messageCount: 0` (callers decide to skip).
   */
  private async summarize(
    conversationId: string,
    needle = "",
  ): Promise<ChatConversationSummary | null> {
    const messages = await this.readMessages(conversationId);
    const meta = await this.readMeta(conversationId);
    const last = messages.at(-1);
    const first = messages.find((m) => m.role === "user") ?? messages[0];
    const derived = oneLine(first?.text ?? "");
    const title =
      meta?.title ?? (derived.length > TITLE_MAX ? `${derived.slice(0, TITLE_MAX - 1)}…` : derived);
    let snippet: string | undefined;
    if (needle) {
      const hit = messages.find((m) => oneLine(m.text).toLowerCase().includes(needle));
      if (hit) snippet = makeSnippet(hit.text, needle);
      else if (!title.toLowerCase().includes(needle)) return null;
    }
    return {
      conversationId,
      title,
      messageCount: messages.length,
      updatedAt: last?.at ?? meta?.updatedAt ?? new Date(0).toISOString(),
      ...(snippet !== undefined ? { snippet } : {}),
    };
  }

  /** Does this conversation have any file on disk (transcript or meta)? */
  async conversationExists(conversationId: string): Promise<boolean> {
    if (!isValidConversationId(conversationId)) return false;
    return (
      (await fileExists(this.fileFor(conversationId))) ||
      (await fileExists(this.metaFile(conversationId)))
    );
  }

  /** Set a custom title. Null when the conversation is unknown. */
  async renameConversation(
    conversationId: string,
    title: string,
    now: Date = new Date(),
  ): Promise<ChatConversationSummary | null> {
    if (!(await this.conversationExists(conversationId))) return null;
    const meta = (await this.readMeta(conversationId)) ?? this.freshMeta(conversationId, now);
    await this.writeMeta({ ...meta, title: oneLine(title), updatedAt: now.toISOString() });
    return this.summarize(conversationId);
  }

  /**
   * Soft delete: MOVE every file of the conversation into `<dir>/.trash/<id>/` (never
   * unlink) and clear the active pointer if it pointed here. False when unknown.
   */
  async deleteConversation(conversationId: string, now: Date = new Date()): Promise<boolean> {
    if (!(await this.conversationExists(conversationId))) return false;
    const trash = await this.freshTrashDir(conversationId, now);
    for (const file of this.conversationFiles(conversationId)) {
      await fs.rename(file, path.join(trash, path.basename(file))).catch(ignoreMissing);
    }
    if ((await this.readActive()) === conversationId) {
      await fs.rm(this.activeFile(), { force: true });
    }
    return true;
  }

  /**
   * Snapshot the conversation into the trash (same layout as a delete, so
   * {@link restoreConversation} works), then empty it in place: no messages, no CLI
   * session (next turn starts fresh, no `--resume`), no custom title, distilled
   * counter reset. False when unknown.
   */
  async clearConversation(conversationId: string, now: Date = new Date()): Promise<boolean> {
    if (!(await this.conversationExists(conversationId))) return false;
    const trash = await this.freshTrashDir(conversationId, now);
    for (const file of this.conversationFiles(conversationId)) {
      await fs.copyFile(file, path.join(trash, path.basename(file))).catch(ignoreMissing);
    }
    const old = await this.readMeta(conversationId);
    await writeFileAtomic(this.fileFor(conversationId), "");
    await fs.rm(this.distilledFile(conversationId), { force: true });
    await this.writeMeta({
      conversationId,
      sessionId: null,
      createdAt: old?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    });
    return true;
  }

  /**
   * Bring back the trashed snapshot (after a delete or a clear; a clear's emptied files
   * are overwritten). Null when the trash holds nothing for this id.
   */
  async restoreConversation(conversationId: string): Promise<ChatConversationSummary | null> {
    if (!isValidConversationId(conversationId)) return null;
    const trash = this.trashDirFor(conversationId);
    const names = await fs.readdir(trash).catch(() => [] as string[]);
    const wanted = new Set(this.conversationFiles(conversationId).map((f) => path.basename(f)));
    const restorable = names.filter((n) => wanted.has(n));
    if (restorable.length === 0) return null;
    // Drop a distilled file the snapshot does not carry, so the counter matches the restored transcript.
    if (!restorable.includes(path.basename(this.distilledFile(conversationId)))) {
      await fs.rm(this.distilledFile(conversationId), { force: true });
    }
    for (const name of restorable) {
      await fs.rename(path.join(trash, name), path.join(this.dir, name));
    }
    await fs.rmdir(trash).catch(() => undefined);
    return this.summarize(conversationId);
  }

  private trashDirFor(conversationId: string): string {
    return path.join(this.dir, CHAT_TRASH_DIRNAME, conversationId);
  }

  /** Empty `.trash/<id>/`; an earlier snapshot is archived next to it, never overwritten. */
  private async freshTrashDir(conversationId: string, now: Date): Promise<string> {
    const trash = this.trashDirFor(conversationId);
    if (await fileExists(trash)) {
      await fs.rename(trash, `${trash}.${now.getTime()}`);
    }
    await ensureDir(trash);
    return trash;
  }

  /** The (possibly non-existent) files that make up one conversation. */
  private conversationFiles(conversationId: string): string[] {
    return [
      this.fileFor(conversationId),
      this.metaFile(conversationId),
      this.distilledFile(conversationId),
    ];
  }

  /** Every conversation id with a transcript on disk (newest intake order not implied). */
  async listConversationIds(): Promise<string[]> {
    const entries = await fs.readdir(this.dir).catch(() => [] as string[]);
    return entries
      .filter((name) => name.endsWith(".jsonl"))
      .map((name) => name.slice(0, -".jsonl".length))
      .filter(isValidConversationId);
  }

  /**
   * How many messages of this conversation have already been distilled. A chat thread
   * is long-lived (unlike a terminal run), so distillation is INCREMENTAL: the nightly
   * pass only feeds messages past this count, then advances it via {@link markDistilled}.
   */
  async distilledCount(conversationId: string): Promise<number> {
    const raw = await fs.readFile(this.distilledFile(conversationId), "utf8").catch(() => null);
    if (raw === null) return 0;
    const parsed = safeJson(raw);
    if (parsed && typeof parsed === "object" && "messageCount" in parsed) {
      const n = (parsed as { messageCount: unknown }).messageCount;
      return typeof n === "number" ? n : 0;
    }
    return 0;
  }

  /** Advance the distilled-through cursor to `messageCount` for this conversation. */
  async markDistilled(
    conversationId: string,
    messageCount: number,
    now: Date = new Date(),
  ): Promise<void> {
    await ensureDir(this.dir);
    await writeFileAtomic(
      this.distilledFile(conversationId),
      `${JSON.stringify({ distilledAt: now.toISOString(), messageCount })}\n`,
    );
  }

  /** The active (single ongoing) conversation, or null if none exists yet. */
  async readActive(): Promise<string | null> {
    const raw = await fs.readFile(this.activeFile(), "utf8").catch(() => null);
    if (raw === null) return null;
    const parsed = safeJson(raw);
    if (parsed && typeof parsed === "object" && "conversationId" in parsed) {
      const id = (parsed as { conversationId: unknown }).conversationId;
      return typeof id === "string" ? id : null;
    }
    return null;
  }

  private async setActive(conversationId: string): Promise<void> {
    await ensureDir(this.dir);
    await writeFileAtomic(this.activeFile(), `${JSON.stringify({ conversationId })}\n`);
  }

  private async ensureMeta(conversationId: string, now: Date): Promise<void> {
    if (await fileExists(this.metaFile(conversationId))) return;
    await this.writeMeta(this.freshMeta(conversationId, now));
  }

  private freshMeta(conversationId: string, now: Date): ConversationMeta {
    const iso = now.toISOString();
    return { conversationId, sessionId: null, createdAt: iso, updatedAt: iso };
  }

  private async readMeta(conversationId: string): Promise<ConversationMeta | null> {
    const raw = await fs.readFile(this.metaFile(conversationId), "utf8").catch(() => null);
    if (raw === null) return null;
    const parsed = safeJson(raw);
    return parsed && typeof parsed === "object" ? (parsed as ConversationMeta) : null;
  }

  private async writeMeta(meta: ConversationMeta): Promise<void> {
    await ensureDir(this.dir);
    await writeFileAtomic(this.metaFile(meta.conversationId), `${JSON.stringify(meta, null, 2)}\n`);
  }

  private async readMessages(conversationId: string): Promise<ChatMessage[]> {
    const raw = await fs.readFile(this.fileFor(conversationId), "utf8").catch(() => null);
    if (raw === null) return [];
    const out: ChatMessage[] = [];
    for (const line of raw.split("\n")) {
      if (line.trim().length === 0) continue;
      const parsed = ChatMessageSchema.safeParse(safeJson(line));
      if (parsed.success) out.push(parsed.data);
      else this.logger.warn(`skipped malformed chat line in ${conversationId}`);
    }
    return out;
  }

  /** Absolute path of a conversation's `<id>.jsonl` (handed to tasks as the full-context reference). */
  transcriptPath(conversationId: string): string {
    return path.resolve(this.fileFor(conversationId));
  }

  private fileFor(conversationId: string): string {
    assertValidId(conversationId);
    return path.join(this.dir, `${conversationId}.jsonl`);
  }

  private metaFile(conversationId: string): string {
    assertValidId(conversationId);
    return path.join(this.dir, `${conversationId}.meta.json`);
  }

  private distilledFile(conversationId: string): string {
    assertValidId(conversationId);
    return path.join(this.dir, `${conversationId}.distilled.json`);
  }

  private activeFile(): string {
    return path.join(this.dir, "active.json");
  }
}
