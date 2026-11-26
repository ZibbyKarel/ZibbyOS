import { Injectable, Optional } from "@nestjs/common";
import type { Goal, GoalInstance, InboxPr } from "@zibby/contracts";
import { ApprovalNotFoundError, InvalidApprovalIdError } from "../approvals/approvals.errors";
import { ApprovalsService } from "../approvals/approvals.service";
import { ChannelItemStore } from "../channels/channel-item.store";
import { InboxService } from "../inbox/inbox.service";
import { LoggerService, type ScopedLogger } from "../shared/logging/logger.service";
import type { GoalFactsContext, GoalFactsSource } from "./goal-facts";
import { GoalStateStore } from "./goal-state.store";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A channel reply's text in the facts: a capped data field (the prompt fences all facts). */
export const REPLY_TEXT_MAX = 300;
/** The reply's sender, capped too (a display name is remote-controlled text). */
export const REPLY_FROM_MAX = 80;

/** One PR the instance watches, reduced to structure (no title, no body: untrusted text stays out). */
export interface GoalPrRow {
  projectId: string;
  repo: string;
  number: number;
  bucket: InboxPr["bucket"];
  headSha: string | null;
  review: InboxPr["review"];
  ci: InboxPr["ci"];
  ciSettled: boolean | null;
  /** `null` until the host computed it once; a later transient `null` keeps the last known value. */
  mergeable: boolean | null;
  draft: boolean;
  unresolvedThreads: number;
  /** Since the PR's last update, coarse so the clock alone rarely changes the fingerprint. */
  age: "<1d" | "1-2d" | "2-7d" | ">7d";
}

export function ageBucket(iso: string, now: Date): GoalPrRow["age"] {
  const days = (now.getTime() - Date.parse(iso)) / DAY_MS;
  if (days < 1) return "<1d";
  if (days < 2) return "1-2d";
  if (days < 7) return "2-7d";
  return ">7d";
}

/**
 * ponytail: a goal "watches PRs" when its own text says so (or it waits on a PR) — a keyword
 * rule matching the PR presets. Add an explicit goal field if a PR goal is ever missed.
 */
// Unicode-aware word edges: JS `\b` is ASCII-only, so it would match "pr" in Czech "práci".
// The acronyms are case-sensitive (no "ci" in Czech text), the phrases are not.
const PR_ACRONYMS = /(?<![\p{L}\p{N}_])(PRs?|MRs?|CI)(?![\p{L}\p{N}_])/u;
const PR_PHRASES = /(?<![\p{L}\p{N}_])(pull requests?|merge\p{L}*)(?![\p{L}\p{N}_])/iu;

export function watchesPrs(goal: Goal, instance: GoalInstance): boolean {
  if (instance.waitingOn?.some((w) => w.kind === "pr")) return true;
  const text = [goal.name, goal.outcome, goal.predicate ?? ""].join("\n");
  return PR_ACRONYMS.test(text) || PR_PHRASES.test(text);
}

/**
 * PR snapshot rows from the PR inbox (`InboxService.listPrs`, itself cached): a project
 * instance sees its project's PRs, a `_` instance (scope `none`) the operator's own. Fetched
 * at most once per tick and only for goals that watch PRs. A failed fetch (or a project the
 * inbox reported an error for) keeps the previous rows, so a host hiccup never wakes a goal.
 */
@Injectable()
export class PrFactsSource implements GoalFactsSource {
  readonly name = "prs";
  private readonly log: ScopedLogger;
  private tickFetch: Promise<InboxPr[]> | null = null;
  private lastGood: InboxPr[] = [];
  private fetchedOnce = false;
  /** Projects in the inbox's `errors` on every fetch so far: no rows ever read, not "no PRs". */
  private neverRead = new Set<string>();
  /** `repo#n` → the last non-null `mergeable`. */
  private readonly mergeable = new Map<string, boolean>();

  constructor(
    private readonly inbox: InboxService,
    logger: LoggerService,
  ) {
    this.log = logger.child(PrFactsSource.name);
  }

  beginTick(): void {
    this.tickFetch = null;
  }

  async collect({ goal, instanceKey, instance, now }: GoalFactsContext): Promise<unknown> {
    if (!watchesPrs(goal, instance)) return undefined;
    const prs = await (this.tickFetch ??= this.fetch());
    if (!this.fetchedOnce || this.neverRead.has(instanceKey)) return { unavailable: true };
    return prs
      .filter((pr) => (instanceKey === "_" ? pr.bucket === "mine" : pr.projectId === instanceKey))
      .map((pr) => this.row(pr, now))
      .sort((a, b) => a.repo.localeCompare(b.repo) || a.number - b.number);
  }

  /** The PRs as last fetched (this tick's when one ran): the `pr-action` handler's scope check. */
  async current(): Promise<InboxPr[]> {
    return (this.tickFetch ??= this.fetch());
  }

  private async fetch(): Promise<InboxPr[]> {
    try {
      const { prs, errors } = await this.inbox.listPrs();
      const failed = new Set(errors.map((e) => e.projectId));
      // A project whose PRs could not be read keeps its previous rows.
      const kept = this.lastGood.filter((pr) => failed.has(pr.projectId));
      this.lastGood = [...prs.filter((pr) => !failed.has(pr.projectId)), ...kept];
      this.neverRead = this.fetchedOnce
        ? new Set([...this.neverRead].filter((id) => failed.has(id)))
        : failed;
      this.fetchedOnce = true;
    } catch (error) {
      this.log.warn("goal facts: PR inbox unreadable — previous rows kept", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return this.lastGood;
  }

  private row(pr: InboxPr, now: Date): GoalPrRow {
    const key = `${pr.repo.toLowerCase()}#${pr.number}`;
    if (pr.mergeable !== null) this.mergeable.set(key, pr.mergeable);
    return {
      projectId: pr.projectId,
      repo: pr.repo,
      number: pr.number,
      bucket: pr.bucket,
      headSha: pr.headSha ?? null,
      review: pr.review,
      ci: pr.ci,
      ciSettled: pr.ciSettled ?? null,
      mergeable: this.mergeable.get(key) ?? null,
      draft: pr.draft,
      unresolvedThreads: pr.unresolvedThreads ?? 0,
      age: ageBucket(pr.updatedAt ?? pr.createdAt, now),
    };
  }
}

/**
 * The approvals the instance waits on (`waitingOn` kind `approval`), read from the approvals
 * store: a settled approval wakes the goal even across a restart (the in-memory dirty ref
 * alone would be lost).
 */
@Injectable()
export class ApprovalFactsSource implements GoalFactsSource {
  readonly name = "approvals";

  constructor(private readonly approvals: ApprovalsService) {}

  async collect({ instance }: GoalFactsContext): Promise<unknown> {
    const ids = refsOf(instance, "approval");
    if (!ids.length) return undefined;
    return Promise.all(
      ids.map(async (id) => {
        // Only a gone (or malformed) id is "missing"; an I/O error fails this instance's tick
        // and leaves the fingerprint as it was, like the PR source.
        const approval = await this.approvals.get(id).catch((error: unknown) => {
          if (error instanceof ApprovalNotFoundError || error instanceof InvalidApprovalIdError) {
            return null;
          }
          throw error;
        });
        return { id, status: approval?.status ?? "missing" };
      }),
    );
  }
}

/**
 * Replies on the channel threads the instance waits on (`waitingOn` kind `reply`, ref
 * `<integrationId>:<channel>:<threadTs>`) and on its sent messages' `replyRef`: a count and the latest reply (id, sender, text capped
 * at {@link REPLY_TEXT_MAX}; the text is data, the prompt fences it).
 */
@Injectable()
export class ReplyFactsSource implements GoalFactsSource {
  readonly name = "replies";

  /** The state store is optional so unit tests can pass only the channel store. */
  constructor(
    private readonly channels: ChannelItemStore,
    @Optional() private readonly store?: GoalStateStore,
  ) {}

  async collect({ goal, instance, instanceKey }: GoalFactsContext): Promise<unknown> {
    // The goal's own sent messages count too: a re-plan that does not restate the reply wait
    // must not lose the colleague's answer.
    const sent = this.store
      ? ((await this.store.read(goal.id, goal.createdAt)).messages ?? [])
          .filter((m) => m.instance === instanceKey && m.replyRef)
          .map((m) => m.replyRef ?? "")
      : [];
    const refs = [...new Set([...refsOf(instance, "reply"), ...sent])];
    if (!refs.length) return undefined;
    return Promise.all(
      refs.map(async (ref) => {
        const thread = parseReplyRef(ref);
        if (!thread) return { ref, count: 0 };
        // `list` already reads a missing integration as empty; any other error propagates.
        const items = await this.channels.list({ integrationId: thread.integrationId });
        // `list` is sorted by receivedAt, so the last one is the latest.
        const replies = items.filter((i) => isReplyTo(i.externalRef, thread));
        const last = replies.at(-1);
        return {
          ref,
          count: replies.length,
          ...(last
            ? {
                last: {
                  id: last.id,
                  ...(last.from ? { from: last.from.slice(0, REPLY_FROM_MAX) } : {}),
                  text: last.text.slice(0, REPLY_TEXT_MAX),
                },
              }
            : {}),
        };
      }),
    );
  }
}

/**
 * A reply in the thread, or — in a direct message (`D…`) — any later top-level message: a
 * colleague answers a DM in the conversation, not in its thread (the DM leg ingests those).
 */
function isReplyTo(
  r: { channel?: string; ts?: string; threadTs?: string },
  thread: { channel: string; threadTs: string },
): boolean {
  if (r.channel !== thread.channel || !r.ts || r.ts === thread.threadTs) return false;
  if (r.threadTs === thread.threadTs) return true;
  return thread.channel.startsWith("D") && !r.threadTs && Number(r.ts) > Number(thread.threadTs);
}

/** `<integrationId>:<channel>:<threadTs>` (Slack ts contains no colon). */
export function parseReplyRef(
  ref: string,
): { integrationId: string; channel: string; threadTs: string } | null {
  const [integrationId, channel, threadTs, ...rest] = ref.split(":");
  if (!integrationId || !channel || !threadTs || rest.length) return null;
  return { integrationId, channel, threadTs };
}

function refsOf(instance: GoalInstance, kind: "approval" | "reply"): string[] {
  return [
    ...new Set((instance.waitingOn ?? []).filter((w) => w.kind === kind).map((w) => w.ref)),
  ].sort();
}
