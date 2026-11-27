// ZibbyOS chat gate for `opencode run` (A25, A33, inline approvals). Every call is judged
// with the run gate's own classifier (`claude-approval-hook.mjs`, imported — never spawned).
// Local refusals are synchronous (tool not allowed, operator-only surface, nested agent,
// `gh.pr_comment`). A classified gated call is NOT refused: it is sent to the API
// (`POST ZIBBY_CHAT_GATE_URL`), which allows it, denies it or opens an approval card in the
// chat. On `pending` this plugin HOLDS the call (`execute.before` returns a promise opencode
// awaits) and polls the card's status until the operator approves or rejects it.
//
//  - Only the one held call whose approval came back `approved` is released, and only if its
//    input still hashes to what was approved. Nothing is cached: an identical later call asks again.
//  - FAIL CLOSED: reject, timeout (the server owns the 300 s deadline, this plugin stops at
//    `ZIBBY_CHAT_GATE_DEADLINE_S`), a missing env, a network or parse error, a non-2xx → refused.
//  - Gated calls are serialised through a queue, so the operator sees one card at a time.
//  - An opaque shell form (`opaqueShell`: nested shell, eval, `$(…)`, wrapper prefix, inline
//    interpreter code, mutating curl …) adds a `shell.opaque` intent: always a card, never silent.
//  - `read` / `grep` / `glob` / `list`: run, unless the path is the operator token dir.
//  - MCP tools of the mounted servers (`ZIBBY_CHAT_MCP_SERVERS`): ZibbyOS's own `zibby` /
//    `zibby-kb` run; an operator server's call is judged like any other (`mcp.read` runs).
//  - everything else (write, edit, patch, `execute`, `question`, `skill`, `task`, web,
//    `opencode_*`, …) is refused. Tools named in `ZIBBY_CHAT_DENY_TOOLS` are refused too.
//
// The turn's config also sets `permissions: deny *` with allow rules for exactly these
// tools (and the turn runs without `--auto`), so if this plugin fails to load the
// risky calls are not judged — but write/edit/execute stay denied by the config.

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  classifyAll,
  classifyEvent,
  intentOf,
  opaqueShell,
  pathTouchesOperatorOnly,
  touchesOperatorOnly,
} from "../../runner/claude-approval-hook.mjs";
import { startsNestedAgent, toClaudeEvents } from "../../runner/opencode-gate-plugin/index.mjs";

/** MCP server ids that would shadow opencode's built-in tool namespaces. */
const RESERVED_MCP_IDS = new Set(["opencode", "browser"]);

/** ZibbyOS's own servers — their tools are the chat's own surface, never classified. */
const OWN_MCP_IDS = new Set(["zibby", "zibby-kb"]);

/** Built-in tools a chat turn may use (judged per call below). */
export const CHAT_BUILTIN_TOOLS = ["shell", "bash", "read", "grep", "glob", "list"];

export const CHAT_DENY_REASON =
  "in the ZibbyOS chat only the shell, file reads and the mounted MCP tools are allowed — no file writes, edits or code execution.";

export const CHAT_DELEGATE_REASON =
  "this is not allowed in the chat. Do not retry or work around it; for asynchronous or long work use the zibby create_task tool, otherwise tell the operator what you would run.";

const list = (v) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !RESERVED_MCP_IDS.has(s));

const prefixesOf = (id) => [`${id}_`, `${id.replace(/[^a-zA-Z0-9_-]/g, "_")}_`];

/** The mounted server `tool` (opencode names MCP tools `<server>_<tool>`) belongs to, or null. */
function mountedServerOf(tool, env) {
  const name = String(tool ?? "");
  // Longest id first, so `zibby-kb_x` is never read as a `zibby` tool.
  const ids = list(env.ZIBBY_CHAT_MCP_SERVERS).sort((a, b) => b.length - a.length);
  return (
    ids.find((id) =>
      prefixesOf(id).some((prefix) => name.startsWith(prefix) && name.length > prefix.length),
    ) ?? null
  );
}

/** Whether `tool` belongs to a mounted server. */
export function isMountedMcpTool(tool, env = process.env) {
  return mountedServerOf(tool, env) !== null;
}

/** Whether the chat turn may use `tool` at all (its input is judged by {@link chatGateReason}). */
export function isAllowedChatTool(tool, env = process.env) {
  const name = String(tool ?? "");
  if (list(env.ZIBBY_CHAT_DENY_TOOLS).includes(name)) return false;
  return CHAT_BUILTIN_TOOLS.includes(name) || isMountedMcpTool(name, env);
}

/** Shell text with escapes and quotes dropped, so `~/.con"fig"/zib\by` reads as written. */
const unquote = (text) => String(text ?? "").replace(/[\\"']/g, "");

/** The shell call's own `workdir` / `directory` (opencode's cwd override), or undefined. */
const workdirOf = (input) =>
  [input?.workdir, input?.directory].find((d) => typeof d === "string" && d);

/** `dir` with `~` / `$HOME` expanded, resolved against `cwd` and through symlinks. */
export function resolveWorkdir(dir, cwd) {
  const home = os.homedir();
  const p = unquote(dir)
    .replace(/^~(?=\/|$)/, home)
    .replace(/^\$\{HOME\}|^\$HOME(?![A-Za-z0-9_])/, home);
  const abs = path.resolve(cwd, p);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

/**
 * A call reaching the operator-only surface (approval API, operator token dir). A shell
 * call is matched on its raw and its unquoted text, on its `workdir`, and — when it has a
 * `workdir` — on every word resolved against it (`workdir: ~/.config` + `cat zibby/…`).
 */
function touchesOperator(e, workdir) {
  const i = e.tool_input ?? {};
  if (e.tool_name === "Bash") {
    if (touchesOperatorOnly(i.command) || touchesOperatorOnly(unquote(i.command))) return true;
    if (!workdir) return false;
    if (pathTouchesOperatorOnly(workdir, e.cwd)) return true;
    return unquote(i.command)
      .split(/[\s;&|<>()=]+/)
      .some((w) => w && !w.startsWith("-") && pathTouchesOperatorOnly(w, workdir));
  }
  return (
    pathTouchesOperatorOnly(i.file_path, e.cwd) ||
    pathTouchesOperatorOnly(i.path, e.cwd) ||
    touchesOperatorOnly(i.pattern)
  );
}

/**
 * Judge one call locally → `{ reason }` (refused), `{ intents }` (the gated actions the API must
 * decide) or `null` (run it). Never waits.
 */
export function chatGateReason(tool, input, env = process.env) {
  const name = String(tool ?? "");
  if (!isAllowedChatTool(name, env)) return { reason: CHAT_DENY_REASON };
  const server = mountedServerOf(name, env);
  if (server && OWN_MCP_IDS.has(server)) return null;
  const cwd = path.resolve(env.PWD || process.cwd());
  let events;
  try {
    events = toClaudeEvents(name, input, cwd, server ? [server] : []);
  } catch (e) {
    return { reason: e?.message ?? CHAT_DENY_REASON };
  }
  const shell = name === "shell" || name === "bash";
  const rawWorkdir = shell ? workdirOf(input) : undefined;
  const workdir = rawWorkdir ? resolveWorkdir(rawWorkdir, cwd) : undefined;
  const intents = [];
  for (const e of events) {
    if (touchesOperator(e, workdir)) {
      return {
        reason:
          "approvals are decided by the operator only — the chat cannot call the approvals API or read the operator token.",
      };
    }
    if (e.tool_name === "Bash" && startsNestedAgent(e.tool_input?.command)) {
      return {
        reason: `a nested opencode / claude session is not allowed — ${CHAT_DELEGATE_REASON}`,
      };
    }
    let requests;
    try {
      // A shell command yields EVERY gated action in it (the server judges them all); other
      // events yield their single classification. An opaque shell form (nested shell, eval,
      // `$(…)`, a wrapper prefix, inline interpreter code, a mutating curl …) adds
      // `shell.opaque`, which the server always turns into a card.
      if (e.tool_name === "Bash") {
        const command = String(e.tool_input?.command ?? "");
        requests = classifyAll(command).map(intentOf);
        const why = opaqueShell(command);
        if (why) requests.push(opaqueIntent(command, why));
      } else {
        requests = [classifyEvent(e)];
      }
    } catch {
      // Fail closed: a call the classifier chokes on goes to the API as `unclassified`, which denies it.
      requests = [{ action: "unclassified" }];
    }
    for (const request of requests) {
      if (request?.action === "gh.pr_comment") {
        return {
          reason: `"gh.pr_comment" — propose the reply with the zibby propose_pr_replies tool instead; the operator sends it from the card.`,
        };
      }
      if (
        request &&
        request.action !== "mcp.read" &&
        !intents.some((i) => JSON.stringify(i) === JSON.stringify(request))
      ) {
        intents.push(request);
      }
    }
  }
  if (!intents.length) return null;
  return workdir ? { intents, cwd: workdir } : { intents };
}

/** The intent of a shell command the classifier cannot see into. */
function opaqueIntent(command, why) {
  return {
    action: "shell.opaque",
    context: JSON.stringify({
      summary: `Neprůhledný příkaz (${why})`,
      consequence: "Gate nevidí, co příkaz skutečně spustí — zkontroluj celý text.",
      preview: { kind: "command", shell: "bash", cmd: command, targets: [] },
    }),
  };
}

/** sha256 hex of `tool + "\0" + JSON.stringify(input)` — must match the API's `chatGateHash`. */
export const chatGateHash = (tool, input) =>
  createHash("sha256")
    .update(`${tool}\0${JSON.stringify(input)}`)
    .digest("hex");

const POLL_MS = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const blocked = (reason) => new Error(`Blocked by the ZibbyOS gate: ${reason}`);

/**
 * Ask the API about one classified call and, when it is `pending`, hold until the operator
 * decides. Resolves only for an allowed / approved call; every other outcome throws
 * (fail closed). `input` is re-hashed after an approval to catch a mutation of the held call.
 */
export async function chatGateCall(
  tool,
  input,
  intents,
  env = process.env,
  fetchImpl = fetch,
  cwd = undefined,
) {
  const url = env.ZIBBY_CHAT_GATE_URL;
  const token = env.ZIBBY_CHAT_GATE_TOKEN;
  if (!url || !token) throw blocked("the chat approval gate is not configured — refusing.");
  const deadlineS = Number(env.ZIBBY_CHAT_GATE_DEADLINE_S);
  const deadline =
    Date.now() + (Number.isFinite(deadlineS) && deadlineS > 0 ? deadlineS : 330) * 1000;
  const hash = chatGateHash(tool, input);
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const call = async (u, init) => {
    const res = await fetchImpl(u, { ...init, headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  let decision;
  try {
    decision = await call(url, {
      method: "POST",
      body: JSON.stringify({ tool, input, hash, intents, ...(cwd ? { cwd } : {}) }),
    });
  } catch (e) {
    throw blocked(`the approval gate could not be reached (${e?.message ?? e}) — refusing.`);
  }
  if (decision?.decision === "allow") return;
  if (decision?.decision === "deny") {
    const reason = String(decision.reason ?? "denied").replace(/\.+$/, "");
    throw blocked(`${reason}. Do not retry or work around it.`);
  }
  const approvalId = decision?.decision === "pending" ? decision.approvalId : undefined;
  if (typeof approvalId !== "string" || !approvalId)
    throw blocked("unreadable gate answer — refusing.");

  const u = new URL(url);
  u.pathname = `${u.pathname.replace(/\/$/, "")}/${encodeURIComponent(approvalId)}`;
  const action = intents.map((i) => i.action).join(", ") || tool;
  for (;;) {
    if (Date.now() >= deadline)
      throw blocked("no decision in time. Do not retry; ask the operator.");
    await sleep(POLL_MS);
    let status;
    try {
      status = (await call(u.toString(), { method: "GET" }))?.status;
    } catch (e) {
      throw blocked(`the approval status could not be read (${e?.message ?? e}) — refusing.`);
    }
    if (status === "pending") continue;
    if (status === "approved") {
      if (chatGateHash(tool, input) !== hash) {
        throw blocked("the call changed after it was approved — refusing.");
      }
      return;
    }
    // rejected, expired, or anything unknown
    throw blocked(
      `the operator rejected "${action}" (or it timed out). Do not retry it or work around it; ask the operator what to do instead.`,
    );
  }
}

// One gated call at a time (the operator decides one card at a time).
let queue = Promise.resolve();

const plugin = {
  id: "zibby-chat-gate",
  async setup(ctx) {
    await ctx.permission.hook("evaluate", (event) => {
      if (event.effect === "deny") return; // a config deny always stands
      event.effect = isAllowedChatTool(event.action) ? "allow" : "deny";
    });
    await ctx.tool.hook("execute.before", (event) => {
      const run = queue.then(async () => {
        const verdict = chatGateReason(event.tool, event.input);
        if (verdict?.reason) throw blocked(verdict.reason);
        if (verdict?.intents) {
          await chatGateCall(
            String(event.tool),
            event.input,
            verdict.intents,
            process.env,
            fetch,
            verdict.cwd,
          );
        }
      });
      queue = run.catch(() => undefined);
      return run;
    });
  },
};

export default plugin;
