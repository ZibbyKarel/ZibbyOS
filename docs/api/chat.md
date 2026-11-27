# API — Chat (chat-first conversation)

ZIBBY's conversational layer — replaces the original Voice UI. The operator
types with ZIBBY in one ongoing thread; a single `claude` turn with tool use
decides whether to **answer / ask a follow-up / act**. Tasks fall naturally out
of the conversation.

**Module:** `apps/api/src/chat/` · **Contract:** `libs/contracts/src/chat/`
**Design spec:** `docs/superpowers/specs/2026-06-23-chat-ui-design.md`

## Endpoints

| Method       | Path                                              | Description                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`       | `/api/chat/messages`                              | Adds the operator's turn and starts the streaming reply. Body: see [Send body](#send-body) → `{ conversationId, turnId }` (returns immediately; tokens arrive over SSE).                                                                                                                                                                                                                                         |
| `GET`        | `/api/chat/transcript?conversationId=`            | Plain read of the conversation transcript (`{ conversationId, sessionId, sessionEngine?, messages }`). Without `conversationId` → the active thread.                                                                                                                                                                                                                                                             |
| `GET`        | `/api/chat/conversations?q=`                      | Past conversations for the history panel, newest first: `[{ conversationId, title, messageCount, updatedAt, snippet? }]`. `title` = custom title (rename) else first operator turn (80 chars); empty threads skipped; `q` = case-insensitive substring over the title and every message; with `q`, `snippet` = ≈140-char single-line excerpt centred on the first matching message (omitted on title-only hits). |
| `PATCH`      | `/api/chat/conversations/:conversationId`         | Rename. Body `{ title }` (trimmed, 1-120 chars, single line) -> `ChatConversationSummary`; unknown -> 404.                                                                                                                                                                                                                                                                                                       |
| `DELETE`     | `/api/chat/conversations/:conversationId`         | **Soft** delete: files move to the [trash](#trash--restore); clears the active pointer if it was active -> `{ conversationId }`; unknown -> 404.                                                                                                                                                                                                                                                                 |
| `POST`       | `/api/chat/conversations/:conversationId/clear`   | Snapshot to the trash, then empty in place (no messages, `sessionId` null so the next turn does not `--resume`, custom title and distilled counter reset) -> `{ conversationId }`; unknown -> 404.                                                                                                                                                                                                               |
| `POST`       | `/api/chat/conversations/:conversationId/restore` | Bring back the trashed snapshot (after a delete or a clear; the UI's 5 s Undo) -> `ChatConversationSummary`; nothing in the trash -> 404.                                                                                                                                                                                                                                                                        |
| `POST`       | `/api/chat/handoff`                               | "Create task" from chat. Body `{ conversationId, upToMessageId? }` → `{ text, compacted, transcriptPath }`: a task description carrying the conversation up to that reply — see [Hand-off](#hand-off-create-task-from-chat). No messages → 404.                                                                                                                                                                  |
| `GET`        | `/api/chat/stream?conversationId=`                | **SSE** (raw `@Sse()`, outside ts-rest) — live tokens. Each `data` is a JSON `ChatTurnEvent`.                                                                                                                                                                                                                                                                                                                    |
| `POST`       | `/api/chat/gate`                                  | Chat plugin only (chat bearer, loopback). Body `{ tool, input, hash, intents[] }` -> `{ decision: "allow" }` \| `{ decision: "deny", reason }` \| `{ decision: "pending", approvalId }`; see [Inline approval gate](#chat-on-opencode-a24--a33--the-default-path). Not in the web client.                                                                                                                        |
| `GET`        | `/api/chat/gate/:approvalId?conversationId=`      | Chat plugin only. Poll a held call -> `{ status }` (the approval status: `pending` \| `approved` \| `rejected`; an expired wait reads as `rejected`); 404 unknown.                                                                                                                                                                                                                                               |
| `POST`/`GET` | `/api/chat/mcp`                                   | In-process **MCP server** (Streamable HTTP) exposing ZIBBY's tools. Called by the spawned `claude` process, not the frontend — gated by `ChatMcpAuthGuard` (see below); `GET` is an unguarded 405 (no server-initiated streaming needed).                                                                                                                                                                        |

### Send body

`POST /api/chat/messages` — every field except `text` is optional.

| Field             | Meaning                                                                                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversationId`  | Thread to continue; omitted → a new one.                                                                                                                                                                                                              |
| `text`            | The operator's turn.                                                                                                                                                                                                                                  |
| `mentions`        | 0-8 `@`-addressed `agent` / `department` / `workflow` units (the composer's `@` resolves an employee to its agent).                                                                                                                                   |
| `target`          | Legacy single mention; normalised to `mentions` server-side.                                                                                                                                                                                          |
| `attachmentSetId` | Set id from `POST /api/tasks/attachments`.                                                                                                                                                                                                            |
| `teamId`          | `#`-tagged team: the `zibby-kb` knowledge-base ceiling for the turn.                                                                                                                                                                                  |
| `projectId`       | `#`-tagged project: named in the turn's system prompt; its team becomes the KB ceiling when no `teamId` is tagged.                                                                                                                                    |
| `companyId`       | `#`-tagged company: named in the turn's system prompt.                                                                                                                                                                                                |
| `skillId`         | `/`-picked skill: its instructions are appended to the system prompt after the governor.                                                                                                                                                              |
| `model`           | Model for this turn: `haiku` / `sonnet` / `opus` / `fable`; omitted → `ZIBBY_CHAT_MODEL ?? "sonnet"`.                                                                                                                                                 |
| `about`           | "Talk about this" context `{ kind, id, label, href?, details? }` (single-line fields; `details` ≤ 24k): rendered into the system prompt as a random-boundary DATA block, never instructions. The stored user message keeps the ref without `details`. |

An unknown `teamId` / `projectId` / `companyId` / `skillId` → **404**, before
anything is written. The tags are one-turn: the web composer clears them after
every send (`useCooChat`).

### Trash / restore

Irreversible deletes are a Never-rule, so `DELETE` and `clear` never unlink:
every file of the conversation (`<id>.jsonl`, `<id>.meta.json`, `<id>.distilled.json`)
goes to `<chatDir>/.trash/<id>/` (`DELETE` moves, `clear` copies then empties in place).
`restore` moves them back (overwriting the emptied files after a clear) and removes the
trash folder. A newer snapshot never overwrites an older one: the older folder is kept
as `.trash/<id>.<epoch-ms>/` (not restorable via the API, still on disk). The store's
readers only see `*.jsonl` files at the top of the chat dir, so the trash is never
listed as a conversation. Conversation ids are validated against
`^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$` (no dots or slashes) before touching any path; an
invalid id on these routes is a 404.

### Hand-off (create task from chat)

`ChatHandoffService` (`chat-handoff.service.ts`) builds the New Task description
for the dock's "Create task" button, so a task never gets only the clicked reply.
It renders the transcript up to (and including) `upToMessageId` as
`**Operator:**` / `**ZIBBY:**` blocks (text only). Up to
`HANDOFF_COMPACT_THRESHOLD_CHARS` (8000) it goes in verbatim; a longer thread is
compacted by a one-shot sonnet-tier call (`spawnOneShot`: `claude -p` or opencode per
the engine, A32) into an implementation
brief (`compacted: true`). If compaction fails, the last 8000 characters are used
instead. The description always references the full `<id>.jsonl`
(`ChatTranscriptStore.transcriptPath`); the New Task form detects that path and
attaches it to the task. A pure read — nothing is written.

### `ChatTurnEvent` (SSE payload)

```ts
{ conversationId, turnId, type: "delta", text }   // a token of visible text
{ conversationId, turnId, type: "tool", tool }     // dispatch notification (ChatToolEvent)
{ conversationId, turnId, type: "done", text }     // turn finished, final text
{ conversationId, turnId, type: "error", message } // turn failed
```

## Engine (`chat-session.service.ts`)

One turn = one spawn of the `claude` CLI (no API key, runs on the Max
subscription). The verified recipe (spike, see spec §7):

```
claude -p <msg> [--resume <sid>] \
  --setting-sources user --settings '{"disableAllHooks":true}' \
  --disallowedTools <built-ins> --append-system-prompt <persona> \
  --output-format stream-json --include-partial-messages --verbose \
  --model sonnet --permission-mode auto \
  --mcp-config <0600 file: zibby + zibby-kb, deleted after the turn> \
  --allowedTools Bash,mcp__zibby__*,mcp__zibby-kb__*,<claude.ai Slack read+draft tools>
  env: CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
```

- **Token streaming** requires `--include-partial-messages` (otherwise whole
  blocks arrive instead). The parser (`chat-stream-parser.ts`, pure) forwards
  only `text_delta`.
- **Continuity:** `--resume <sessionId>` keeps context; the session id persists
  per conversation and is passed again every turn (the server is stateless per
  turn).
- **The operator's setup, without its context (A30).** The chat is a superstructure
  over the operator's terminal, so a turn loads the operator's **user** settings
  (`--setting-sources user`): the claude.ai connectors (Slack, Atlassian, Figma,
  Claude Data/Docs, …), the user-scope MCP servers and the MCP servers of enabled
  plugins come up natively, exactly as in `claude`. What would inject foreign context
  into the butler is switched off:
  - `--settings '{"disableAllHooks":true}'` — no hook fires (SessionStart "You have
    superpowers", the operator's tool-usage hooks). Plugins whose tools are registered
    by a hook (`helper-desk`, `handoff`) are therefore absent.
  - `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` — no `~/.claude/CLAUDE.md` or project CLAUDE.md
    (the operator's file has RTK/graphify tool rules that must not reach the butler).
  - `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` — no auto-memory of the turn's cwd
    (`~/.claude/projects/<cwd>/memory/MEMORY.md`); without it, the memory
    instructions and index leaked (seen live).
  - Plugin skills are listed in the init event but the `Skill` tool is on the denylist,
    so no skills listing reaches the prompt (the model reported none, live).

  Project and local settings are still not loaded. The rest of the user settings
  (`env`, permission rules, language, output style) comes along too; only the effects
  above were checked live. Auth stays the keychain login (`CLAUDE_CONFIG_DIR` breaks
  auth — do not use it). History: the former `--setting-sources ""` isolation (A23 era)
  stopped carrying the connectors — on CLI 2.1.322 its init event shows
  `mcp_servers: []`, so the chat had no Slack/Jira and `CHAT_SLACK_TOOLS` pointed at
  tools that were not there.

- **`--disallowedTools <built-ins>`** (`CHAT_HIDDEN_BUILTIN_TOOLS`) hides every
  built-in tool (Read/Write/Edit/…) except **Bash**, which the operator gave the
  chat on purpose (same shell as their own `claude` session — e.g. `gh pr view`);
  it is also on `--allowedTools`, so it runs without a prompt. ZIBBY chat is a conversational butler,
  not a coding agent — it may only act through the `zibby` MCP tools
  (`create_task` delegates the work to a workflow; `autopilot_off` pauses ZIBBY, see
  [autopilot.md](./autopilot.md) — there is no tool that resumes it). Without this, the model tries
  to build the app itself via Bash/Write instead of dispatching. (Verified with a
  live eval.) It is a denylist rather than `--tools ""` because a `--tools` value
  also dropped the operator's claude.ai connectors (verified 2026-10-26, not re-checked
  under A30). Read-only built-ins (Read/Glob/Grep) run
  without a permission prompt, so they must stay on the denylist.
- **Working directory.** A turn tagged with `#project`, or opened about a GitHub
  URL whose repo matches a project's `gitRemote`, spawns with `cwd` set to that
  project's local checkout (`ProjectLocalService.resolve`: `path`, else
  `<cloneRoot>/<id>`); the scope line names the same path.
- **claude.ai connectors (`--permission-mode auto`).** The CLI loads the
  operator's claude.ai connectors (Jira/Confluence, Slack, …) from the login plus user
  settings (A30; a read-only Slack call verified live 2026-11-12). They are deferred
  tools, reached through `ToolSearch`.
  Since 2026-11-05 (operator's call) the chat runs `auto`, not `dontAsk`: the
  chat is a window onto the operator's terminal, so every connector is usable
  (Jira verified live). `CHAT_SLACK_TOOLS` stays as the pre-approved Slack
  read/draft set; any off-list tool — **including connector writes such as Slack
  send or Jira create/transition** — is decided by the CLI's auto-mode
  classifier, no longer hard-denied. `--disallowedTools` is still absolute.
- The model is overridable via `ZIBBY_CHAT_MODEL` (default `sonnet`).
- **Operator MCP servers (A30, replaces A23's merge).** The operator's user-scope and
  plugin MCP servers load natively from user settings, so the `--mcp-config` file holds
  only `zibby` / `zibby-kb` (no duplicates, and the operator servers' secrets are no
  longer copied into a per-turn file). `readOperatorMcpServers`
  (`inventory/operator-mcp-servers.ts`) is still used by workflow runs. Their tools are
  not on `--allowedTools`, so the auto-mode classifier decides each call.
- **Secret files and process lifetime.** The `--mcp-config` file (ZibbyOS's bearer
  tokens) is deleted when the turn ends, on every path
  (reply, error, timeout, spawn failure). At start the service sweeps any
  `mcp-config_*.json` / `opencode-chat_*.json` older than a turn can live (crash leftovers).
  Every turn (both engines) is spawned detached; a timed-out turn gets `SIGTERM` on its
  whole process group, then `SIGKILL` after 3 s, and turns still running at shutdown are
  killed the same way — no grandchild outlives the turn with a valid token.

### Chat on opencode (A24 / A33 — the default path)

Since A31 the default `aiEngine` is `opencode`, so this is how the chat runs for every
model family (Claude via `claude-agent/*`, OpenAI, OpenCode free, BlueCode via
`bluecode/*`). The native Claude path above runs only when `aiEngine: "claude"` is stored
(or an `@agent` names it).

When BlueCode is configured (A34), `buildOpencodeChatConfig` adds a `provider.bluecode`
block (base URL, API key, model snapshot) to the turn's 0600 config, the same file that
already carries the MCP credentials. See [ai-engines.md](./ai-engines.md).

A turn runs on the **effective engine**: `resolveAiEngine` with the mentioned `@agent`
(its `engine` / `engineModel`), else `SystemConfig.aiEngine`. The model tier is the
per-turn `model` ?? the agent's `model` ?? `ZIBBY_CHAT_MODEL` (when it is a tier), and the
opencode model comes from `opencodeTierModels` (`resolveTierModel`, an agent's
`engineModel` wins).

```
opencode run --standalone --format json -m <provider/model> --agent zibby [--session <id>] -- <msg>
  env: OPENCODE_CONFIG=<0600 file, deleted after the turn>, OPENCODE_DISABLE_PROJECT_CONFIG=1,
       PWD=<turn cwd>, ZIBBY_CHAT_MCP_SERVERS=atlassian,figma,<operator ids…>,zibby,zibby-kb,
       ZIBBY_CHAT_DENY_TOOLS=<zibby_create_task in an @agent turn, else empty>,
       ZIBBY_CHAT_GATE_URL / ZIBBY_CHAT_GATE_TOKEN / ZIBBY_CHAT_GATE_DEADLINE_S=<inline approval gate, see below>  (no inherited OPENCODE_*)
```

**Live deltas.** `opencode run --format json` only prints finished `text` parts, so each
turn first starts its own `opencode serve --port 0` (`startOpencodeEventServer`, same
per-turn env, a random `OPENCODE_SERVER_PASSWORD`), subscribes to its `GET /api/event` SSE
stream and then runs `opencode run --server <url>` (instead of `--standalone`) against
it. Every `session.text.delta` frame becomes a chat `delta` event; once one arrived, the
run's whole `text` parts only feed the stored reply and `done` (no duplicate delta). The
server is closed (SIGTERM, then SIGKILL after 2 s) when the turn ends, however it ends,
and on API shutdown. If it never reports its address, the turn falls back to
`--standalone` with one delta per text part. Each server leaves an
`opencode-serve_<api pid>_<server pid>.pid` file in the chat dir while it lives; if the API
dies without closing it, the next start (`sweepOrphanEventServers`) kills the process group
of every pid file whose API is gone and whose command line still reads `opencode … serve`.

- **MCP servers (A33)**, later entries winning a name: the OAuth remotes `atlassian`
  (`https://mcp.atlassian.com/v1/mcp`) and `figma` (`https://mcp.figma.com/mcp`); the
  operator's own servers from `readOperatorMcpServers` for the turn cwd (user scope +
  enabled plugins as `plugin_<plugin>_<server>`, minus the ones disabled for that cwd, and
  never `serena`); then ZibbyOS's `zibby` + `zibby-kb` (bearer header, `oauth: false`).
  A remote without its own headers keeps opencode's OAuth auto-detection. No Slack (see
  below).
- **Login is the operator's, once.** opencode stores an MCP OAuth credential in
  `~/.local/share/opencode/opencode.db` (table `credential`), keyed by integration id
  `mcp_` + the first 16 hex chars of `sha1(<server name> + "\0" + <url>)` — not by config
  file. Any config naming the same server with the same URL reuses it, so the per-turn
  config picks up a login made once in a terminal (see the handoff's "Operator login
  commands"). ZibbyOS never runs a login itself.
- **A server that needs auth doesn't break the turn:** opencode marks it `needs_auth`
  ("requires a login before it can register a client"), logs a warning and runs the turn
  without its tools (verified, opencode 2.2.7).
- **Startup budget:** opencode waits at most 2 s for MCP servers before the first model
  call (`MCP.awaitStartup`, hard-coded). A stdio server that starts slower — the
  operator's Playwright plugin via `npx @playwright/mcp@latest` connected after ~3.7 s —
  is not in that turn's toolset, and every turn is a fresh process.
  `toOpencodeMcpServer` therefore swaps `npx [-y] <pkg>[@latest]` for the absolute bin of a globally
  installed `<pkg>` (`npm i -g @playwright/mcp`; pinned versions stay on `npx`).
- **Config:** the chat prompt plus `OPENCODE_CHAT_NOTE` (what the chat has, that risky
  steps go to `create_task`, that a server needing login is skipped, no Slack) as the
  `zibby` agent; `permissions` = deny `*`, allow `shell`, `bash`, `read`, `grep`, `glob`,
  `list` and `<server>_*` per mounted server (then deny `zibby_create_task` when an
  `@agent` is mentioned); plugin `chat/opencode-chat-gate/index.mjs`. No `--auto`.
  Write, edit, patch, Code Mode `execute`, question, skill, subagent, web and
  `opencode_*` tools stay denied by the config and again by the plugin.
- **Inline approval gate.** The plugin runs the run gate's classifier in-process
  (`classifyAll` / `classifyEvent` from `runner/claude-approval-hook.mjs`) and, for every
  classified call, `POST`s `/api/chat/gate` (chat bearer, loopback only) with
  `{ tool, input, hash, intents[] }` (a chained command sends every action). Local refusals
  stay: nested agents, `gh.pr_comment`, the operator-only surface, disallowed tools.
  `ChatGateService.check` answers:
  - **deny** (no card): no turn in flight, hash mismatch, autopilot paused, an unclassified
    or gate-denied action anywhere in the chain (merge, deploy, ...), a raw command that
    names the ZibbyOS data dir, or a command over 20,000 characters;
  - **allow** (silent): every action is allowed by an explicit rule (`ruleId`), none is a
    file effect or `mcp.*`, and it is not an `@agent` turn;
  - **pending**: everything else (ask, notify, default allow). It creates a `kind:"chat"`
    approval (runId `<conversationId>/<hash16>`, `action` = `delete` if present, else the
    first intent; summary "Actions: a, b"; `detail` keeps the FULL raw command) and pushes
    the `{kind:"approval", approvalId}` widget into the chat. Autopilot never auto-approves it.
    While pending the plugin polls `GET /api/chat/gate/:approvalId` every 1 s and holds the
    tool call. Only `approved` releases it, after re-hashing the input; the approval releases
    exactly that one call and nothing is cached, so an identical later call asks again.
    Reject, expiry (300 s, applied in `status()`), turn end (`settleTurn` rejects the turn's
    pending approvals) or an API restart all deny, and so does any plugin-side error (fail
    closed). The turn's kill timer is extended by the wait when the card appears. A reject
    reaches the model as `Blocked by the ZibbyOS gate: the operator rejected "<action>". Do
not retry it or work around it ...`. The card is also decidable in the approvals queue.
    Read/grep/glob/list run, except on the operator token dir / approvals API (refused);
    `zibby` / `zibby-kb` tools run; an operator-server call runs only when A28's `classifyMcp`
    reads it as `mcp.read`, any other write goes through the card.
    Ceiling: as in runs, MCP classification is by tool name only; the data-dir check is a
    substring match.
- **On `claude-agent/*`** the Claude Agent SDK runs with `settingSources: []`,
  `strictMcpConfig: true` and `allowedTools: ["mcp__opencode__*"]` (hard-coded by
  opencode): Claude sees only what opencode mounts, bridged as `mcp__opencode__<tool>`,
  so claude.ai connectors (Slack, Atlassian, Figma, Claude Data/Docs) are unreachable —
  Atlassian and Figma come from the remotes above instead.
- **No Slack on opencode.** Slack's official MCP (`https://mcp.slack.com/mcp`) has no
  dynamic client registration and admits only directory-published or internal apps.
  opencode's own Slack ("OpenCode Console" → Integrations → Slack) needs an OpenCode
  Console cloud account and relays through opencode.ai; it is not mounted. Slack stays
  on the native Claude path and the channel adapters.
- **Session:** the transcript stores `sessionEngine` next to `sessionId`. A stored session
  of the other engine is not resumed — the turn starts a fresh session.
- **Stream:** `text` parts → `delta` (whole parts, joined with a blank line); `tool_use`
  → `tool` (`zibby_get_status` → `mcp__zibby__get_status`; a blocked call shows as
  `status: "error"`); `error` → `error` (`opencode: <message>`); a nonzero exit with no
  text → `error`; an exit with no text, no tool call and no error event → `error`
  (`opencode skončil bez odpovědi.`), never an empty assistant message. There is no `result` line; the turn ends when the process exits.
- **Unusable opencode** (no binary, no model, model not in `opencode models`) → one
  `error` event with the preflight message, no Claude fallback (A7).
- The assistant message records `model` (the tier) plus `engine: "opencode"` and
  `engineModel`. Nothing Claude-limit-specific runs in the chat path.

Chat spawns get their env from `agentBaseEnv()`, which strips the operator-token env vars
(approval decisions are operator-only; see `docs/api/approvals.md`).

## Tools (`chat-tools.service.ts` + `chat-mcp.controller.ts`)

The chat persona (`chat-persona.ts`) defines **mozek** up front: the operator's Obsidian vault, entry note `INDEX`, connected KBs in the `knowledge-bases` registry note (see `docs/api/memory.md`). A question about a team/area goes registry → KB → answer via the KB tools below.

An MCP server hosted directly in the API (`@modelcontextprotocol/sdk`,
Streamable HTTP, stateless), so services are injected — no second process.
Server id `zibby`:

| Tool                       | Calls                                                       | Effect                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_task`              | `TaskSchedulerService.createTask`                           | Classifies + dispatches a task. The run's outputs are still guarded by the gate layer. D-020: an optional `mention` arg names WHICH `@mentioned` unit this call is for — see below.                                                                                                                                                                                |
| `recall_memory`            | `VaultService.search`                                       | Index-first search over mozek (the brain = the Obsidian vault); when the whole query matches nothing it falls back to a per-term search ranked by term coverage (`recall.helper.ts`). For a daily Slack digest (`slack-YYYY-MM-DD`) it returns the matching conversation entries verbatim — date, place, people, agreement, Slack link — see `docs/api/memory.md`. |
| `list_knowledge_bases`     | `KbRegistryService.list`                                    | Lists the connected knowledge bases from the mozek registry note `knowledge-bases` (id, name, description, domain, root). Read-only.                                                                                                                                                                                                                               |
| `search_knowledge_base`    | `KbRegistryService.get` + `KbReaderService.search`          | `{kbId, query}` — index-first search inside one registered KB; results wrapped in the untrusted-data envelope (Law 4). Operator chat is unscoped (any registered KB).                                                                                                                                                                                              |
| `read_knowledge_base_note` | `KbRegistryService.get` + `KbReaderService`                 | `{kbId, path}` — one KB note by KB-relative path, enveloped. Unknown `kbId` → error text.                                                                                                                                                                                                                                                                          |
| `get_status`               | `BriefingService.assemble` / `DepartmentsService.get`       | A "what's happening" summary (read-only). NS2 F3c: an optional `department` argument (enum sourced from the `DEPARTMENTS` registry, never hard-coded) narrows the answer to one department — its state, tier counts, and recent owner-tagged activity ("co dělá Dev?"); without it the global briefing summary is unchanged.                                       |
| `machine_rename`           | `MachineService` (via `ChatToolsService.proposeRename`)     | PROPOSEs a find/replace rename of files in a named folder — never renames itself; parks a Tier-3 machine approval (see `docs/api/machine.md`).                                                                                                                                                                                                                     |
| `open_maps`                | `MachineService` (via `ChatToolsService.proposeOpenMaps`)   | PROPOSEs opening Apple Maps with a search query — still approval-gated even though it only opens a window.                                                                                                                                                                                                                                                         |
| `open_folder`              | `MachineService` (via `ChatToolsService.proposeOpenFolder`) | PROPOSEs opening a named folder in the operator's file manager — still approval-gated.                                                                                                                                                                                                                                                                             |

### Canvas — `publish_canvas`

`publish_canvas({title, html, id?, note?})` publishes a visual / interactive answer through
`CanvasStore.publish` (see `docs/api/canvas.md`) with the turn's conversationId, then pushes a
`{kind: "canvas", id, version, title}` widget via `ChatToolResultRegistry.pushWidget`, which
reaches the transcript and SSE stream exactly like a `show_widget` card (tool event
`show_widget`; the `publish_canvas` stream line itself is suppressed). The tool description
carries the authoring rules (transparent glass, CSS-var colours, pinned CDN libs, no network).
Passing an existing `id` creates a new version. Store rejections come back as an MCP error text.
The description also documents the page API (`<script type="application/zibby+json">` manifest with
`params` / `net`, `zibby.params|on|set|fetch|download|ask|propose|saveState`, `zibby://` links).

`set_canvas_params({id, params, note?})` calls `CanvasStore.setParams(id, params, {by: "agent", note})`
(a new params version, validated against the manifest), then pushes the canvas widget with the new
current version; the `set_canvas_params` stream line is suppressed like `publish_canvas`. Rejections
(`bad-params`, `not-found`, ...) return `Canvas rejected: <message>` as an MCP error.

`get_canvas({id})` (read-only) returns compact JSON: `id`, `title`, `current`, the declared `params`
(id, label, type, unit, min, max, step, options) of the current code version, the effective `values`,
`net` origins and `versions` (`{version, kind, base?, by?, note?, at}`). Unknown id → error text.

### Inline cards — `show_widget` (Zibby overlay)

`show_widget` drops an inline, interactive **card** ("chat widget") into the thread
instead of the model listing the same data as text. A widget is a **reference**, not a
snapshot — `ChatWidgetSchema` (`libs/contracts/src/chat/chat.schema.ts`) is a
discriminated union on `kind` carrying only ids/filters (`runRef`, `projectId`, `limit`,
`title`); the web card loads live data through the same queries the dashboard widgets use.

Kinds: `run`, `runs`, `prs`, `issues`, `approvals`, `briefing`, `mentions`,
`project-status`, `ci`, `todo`.

`pr-replies` is the one widget that carries data: it is not offered by `show_widget` but
dropped by the `propose_pr_replies` tool (`prUrl` + `replies: {threadId, body?, resolve?}[]`,
parsed to `repo` / `number` / `url`). The drafts ARE the proposal; the card loads the threads
live, prefills each draft like the PR detail's "Review threads" block, and the operator edits
and sends them (per thread or "send all") through `replyInboxPrThread` — that click is the
approval. This is how the chat replies on a PR: the chat gate refuses `gh.pr_comment` and
points the model here (unless the operator's rules `allow` it).

`todo` shows a PROJECT's vault `TODO.md` (open items; checkbox ticks the item in the file via
`PATCH /api/todo/projects/:projectId/items/:number`, play starts a task from its text). `projectId` is
the project to show (the model passes the discussed / `#`-tagged one); omitted, the card offers a
project select. The task is not linked back to the item. See `docs/api/todo.md`.

Flow: the MCP handler validates the input against `ChatWidgetSchema` and calls
`ChatToolResultRegistry.pushWidget(conversationId, widget)`; the running turn
(`runTurn`, subscribed through `onWidget`) emits it as a `tool` event
`{ name: "show_widget", status: "ok", callId: "w-<uuid>", widget }` and persists it in the
message's `toolEvents`. The generic single-phase event for the `show_widget` stream line
is suppressed, so each card appears exactly once. With no turn in flight the tool returns
an error to the model. Showing a card is read-only — any action on a card (approve,
reject, "fix it") is the operator's click and goes through the normal gated endpoints.

### Auth on `/api/chat/mcp` (`ChatMcpAuthGuard`)

`POST /api/chat/mcp` carries a real tool surface (6 privileged tools) on an
all-interfaces bind (`main.ts`'s bare `app.listen(port)`), so it's locked down by
`ChatMcpAuthGuard` (`chat-mcp-auth.guard.ts`, added in `2e3dbf9`) — the first
NestJS `CanActivate` guard in this codebase. It enforces two checks independently
(both must pass):

1. `Authorization: Bearer <token>` compared against a per-boot token
   (`ChatMcpAuthService`) via `crypto.timingSafeEqual` (constant-time — the
   length-mismatch case is checked first so a wrong-length token 401s instead of
   throwing).
2. `req.socket.remoteAddress` must be a loopback address (`127.0.0.1`, `::1`, or
   the IPv4-mapped `::ffff:127.0.0.1`) — a request-level check scoped to this one
   route, not a global rebind of the server to loopback-only.

`GET /api/chat/mcp` (`rejectGet`) carries no tool surface, so it stays unguarded —
it only ever returns a 405.

### todo-30 — per-turn model

`SendChatMessageBody.model?: "haiku" | "sonnet" | "opus" | "fable"` picks the
model for that turn (`claude --model <model>`); omitted → the API
falls back to `ZIBBY_CHAT_MODEL ?? "sonnet"`. The persisted assistant `ChatMessage` carries the same
`model?` so the transcript records what answered (on opencode also `engine: "opencode"` + `engineModel`, A24). The dock keeps the pick
sticky in `localStorage` (`zibby.chat.model`); it applies from the next turn and
the thread (`--resume`) is kept.

### D-020 — attachments + several `@`-mentions

The dock's composer reuses the existing task-attachment upload
(`POST /api/tasks/attachments`) — there is no second upload path — and its
`@`-mention picker can now assign SEVERAL agents/workflows/departments in one
turn, not just one.

**Contract.** Both fields on `SendChatMessageBody` are additive/`.optional()`:

- `attachmentSetId?: string` — the id returned by the upload above.
- `mentions?: ChatMentionTarget[]` — 0–8 units, restricted to `agent` /
  `department` / `workflow` (never `loop`/`orchestrator` — the same
  explicit-only-kinds restriction as everywhere else). The legacy single
  `target` is still accepted; the server normalises
  `mentions = mentions ?? (target ? [target] : [])`
  (`ChatSessionService.sendMessage`) so an old-shaped caller keeps working
  unchanged, and every downstream reader (the registry, `create_task`'s
  routing rule, the persisted transcript) only ever looks at the one,
  normalised list.

The persisted user `ChatMessage` gains `mentions?` (the normalised list),
`attachments?` (the resolved `Attachment[]` metadata) and `attachmentSetId?`
(the raw set id, kept alongside the resolved metadata so
`ChatTranscriptStore` can act as an attachment-set ref provider — see below).
The transcript UI (`ChatMessage.tsx`) renders both the mention chips
(`TargetIdentity`) and the attachment names (`FilePreview`, read-only) on the
user's own bubble.

**Routing — `create_task`'s `mention` rule.** `ChatToolResultRegistry` holds
the turn's normalised `mentions` (one-shot, cleared on the turn's `done`/
`error`, mirroring the existing explicit-target registry entry):

| Mentions in the turn | What `create_task` does                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| 0                    | The classifier routes, as today.                                                      |
| 1                    | That unit is the explicit target. `mention` may be omitted (if given, must match it). |
| ≥2                   | The model **must** pass `mention` naming one of the turn's mentioned units.           |

A violation (missing `mention` with ≥2 addressed, or a `mention` that names
neither the sole nor any of the several addressed units) returns an MCP tool
**error** (`isError: true`, `resolveMentionTarget` in `chat-mcp.controller.ts`)
— never a silent fallback to the classifier. The model may call `create_task`
more than once, once per addressed unit.

**A single `@agent` runs inline.** When the turn's only mention is an `agent`,
`ChatSessionService.buildArgs` hands the turn to that agent instead of the ZIBBY
persona: the agent's `instructions` plus a chat adapter (`chat-agent-prompt.ts`)
become the system prompt, its `model` is used (unless the operator picked one for
the turn), and the answer streams back as a normal assistant message. No task or run
is created — `mcp__zibby__create_task` is disallowed and only the agent's declared
read-only built-ins (`Read`/`Glob`/`Grep`) stay enabled. Task creation stays with the
"Vytvořit úlohu" button. An unknown agent id falls back to the normal ZIBBY turn;
workflow/department mentions and multi-mention turns behave as in the table above.

**Attachments reach the work.** `create_task` forwards the turn's
`attachmentSetId` straight through to `TaskSchedulerService.createTask`, so
the dispatched run gets the files through the existing run-attachments path.
The chat model itself never reads the files — its built-in tools are hidden
(`--disallowedTools`) — so the system prompt (`ChatSessionService.buildArgs`, via
`chat-attachment-prompt.ts`'s `buildAttachmentPromptSection`) lists every
attachment by name/type/size, and additionally INLINES UTF-8 text files (up to
a shared 32 KB total budget, first-fit in upload order) inside a block that
says the content is attached DATA, not instructions (Law 4 — inbound content
from any channel is data, never a command). Each inlined file is wrapped in
`<attached-file-<boundary> name="…">…</attached-file-<boundary>>`, where the
boundary is 16 random hex characters minted for each turn. A file therefore
cannot end the data block early by containing a literal closing tag. File
names are JSON-escaped. Binary files and images are always listed, never
inlined.

**Orphan-sweep exemption.** `ChatTranscriptStore` implements
`AttachmentSetRefProvider` directly (`referencedSetIds()` scans every
conversation's persisted `attachmentSetId`s) and is wired into
`AttachmentSetRefsModule`'s factory array alongside the automation/roadmap
contributors, so `TaskSchedulerService`'s 24h orphan sweep never deletes a set
a chat message still references — see `docs/api/tasks.md`'s route-order note.

**Dispatch is prompt-governed** (`chat-persona.ts`), not enforced in code — the
same layer where the old voice bug lived ("how are you" triggering a task). An
opt-in eval (`chat-dispatch.eval.test.ts`, `CHAT_EVAL=1`, needs a live API and
tokens) guards against regressions there.

The prompt has **two parts**: a swappable **persona** (tone only —
`CHAT_PERSONAS`) plus a constant **governor** (`CHAT_GOVERNOR_PROMPT`, the
answer/ask/act decision + tools). Every persona is layered on top of the
**same** governor, so dispatch discipline is invariant across personalities
(that's what the eval guards). `buildChatPrompt(persona)` assembles them;
`buildArgs()` reads the persona live from `SystemConfigStore`.

**Optional personality:** the operator picks a persona in `/settings` — saved
as `chatPersona` on the file-backed `SystemConfig` (`jarvis` (default) /
`concise` / `formal`). Read per turn, so it takes effect on the next
conversation without a restart (only the tone changes, not the behavior). The
change does not apply mid-way through a running `--resume` thread.

## Persistence + memory

- **Transcript:** append-only JSONL `data/chat/<conversationId>.jsonl` (one
  `ChatMessage` per line) + a sidecar `<id>.meta.json` holding the session id +
  `active.json` (a pointer to the active thread). `CHAT_DIR` env override.
- **Distillation:** the nightly `MemoryDistillerService` sweep also covers
  conversations — **incrementally** (a thread is long-lived): it distills only
  the messages past the `<id>.distilled.json` marker (a message count) and
  advances the cursor. Important facts flow into vault markdown the same way
  runs do.
- **Slack operator DM:** the [operator channel](./operator-channel.md#inbound-phase-2)
  is a second caller of `ChatSessionService.sendMessage`. It always writes to the
  fixed conversation `slack-dm-<dmChannelId>`, so a Slack thread is an ordinary
  transcript: the history sidebar lists it and the web can continue it. Slack
  turns send only `{ conversationId, text }`, with no tags, mentions or
  attachments.

## Web overlay (Zibby, shell-global — replaced the dock)

`/chat` has no page of its own — it is a `next.config.mjs` permanent redirect (D-009). The chat UI is
**Zibby**, a full-screen overlay (`apps/web/features/zibby/ZibbyHost.tsx`, composing the DS `ZibbyOverlay`
frame) mounted once in `AppShell` inside `ChatProvider`, so it is reachable from every route. It replaced
the old COO dock (`ChatDock` — summoned by ⌘/Ctrl+J, now gone, decision D-7); the DS `ChatDock`/`ChatBubble`
components still exist for the knowledge `NoteDock` window.

- **Engine:** `useChatDock` (`features/chat/hooks/useChatDock.ts`) is unchanged in role — the single owner of
  the chat stream (`useChatStream` + `useSendChatMessageMutation`, the same `claude --resume` conversation id)
  and of the reload hydration off `GET /api/chat/transcript`. It is called ONLY by `ZibbyHost`, so the app keeps
  exactly one SSE `EventSource`. It now also takes `{ onTurnComplete, onTurnError }` and `send` returns the
  optimistic user message id (the host records voice vs typed origin by it).
- **Open state** is still `ChatContext.dockOpen` (`open(target?)`, `openAbout(next)`, `setDockOpen`), so every
  existing caller works unchanged: a department page's "Chat with" button opens it with an explicit department
  target (O-20, shown as a clearable chip), `ChatAboutButton` opens it about a thing. It closes on a route change.
- **Summon:** the configurable global hotkey (default Alt+Space, Ctrl+Space as an alias off macOS — see the
  Settings → Shortcuts block): a tap toggles, a hold is push-to-talk (release sends). Also the orb in the header's Zibby section (`ZibbyModeControl`: orb + "Zibby" + the status dropdown; the orb is
  violet while Zibby runs, asleep while paused, and mirrors the live state while the overlay is open) and any file dragged over the closed app. The overlay's orb flies out of / back into that header orb (`readOrbOrigin` finds `ZibbySectionTestId.OrbSlot`;
  no origin when it is not rendered).
- **Voice:** bare Space (outside text fields) talks while the overlay is open; hold mode or hands-free; the
  utterance is sent as a message at once — through the composer, so pending attachments ride along (if the
  composer's submit is blocked, e.g. a turn is in flight, the words land in its draft). Completed replies are
  read aloud unless voice is off; talking interrupts (the cut reply gets a trailing "…"). Hands-free never
  re-arms the mic after Zibby speaks.
- **Thread:** the same message pieces as before (`ChatTranscript`/`ChatMessage`, now in the `ZibbyBubble` look):
  markdown replies, tool rows, the living run card, widget cards (`ChatWidgetCard`, follow-up prompts are sent as
  messages), the briefing card, mentions/attachments on the user's bubble, per-message read-aloud, and
  "CREATE TASK" on a settled reply. User bubbles show "přepis · HH:mm" / "napsáno · HH:mm" for turns sent in this
  session (a persisted turn shows only the time).
- **Composer (D-020):** the rich `CommandLine` (`multipleTargets`, `@` mentions, `#` scope, `/` skills, attach,
  model picker) between the push-to-talk button and send. Files dragged anywhere on the page are uploaded through
  the composer's own attach path (`injectedFiles`, max 10).
- **Conversations:** history panel (Today / Yesterday / This week / Older, full-text search), rename, clear,
  soft-delete with a 5 s undo (`features/zibby/conversations`, the `PATCH`/`DELETE`/`clear`/`restore` routes above).
- **Preserved across navigation, reset by "New conversation":** `ChatProvider` mints `conversationId` once and
  keeps it between routes — the same id keeps `--resume`-ing ZIBBY's `claude` session.
- "Create task" on a settled reply calls `POST /api/chat/handoff` and opens `/work/tasks/new` prefilled with the
  hand-off text; if that call fails, the form gets the reply plus a pointer to the conversation id.

## MVP scope

One ongoing thread per browser session (ephemeral — lost on reload).
Branches/sub-threads and resuming an earlier thread from `/transcript` are a
deferred increment (spec §2).

<!-- ZibbyOS ZB-04a (2026-09-25): reviewed alongside the parent/source/department task stamps. -->

<!-- Last reviewed 2026-10-23: still accurate after the verify-phase / project-checks removal (D-024). -->

The chat "about" URL may be a GitLab merge request: its host + path is matched against the projects' `gitRemote` to pick the turn project.

## Accounts and the chat self-API

Integrations are accounts owned by a company or by the operator (personal) — never by a
project (`docs/api/integrations.md`). The chat self-API may create and edit an account, but
changing its owner (`companyId`) stays operator-only.
