# Chat inline approvals (TODO #31): plan

Branch `feat/chat-inline-approvals` in `worktrees/chat-approvals`, off main `48fc80e59`.

> TODO #31: "Chat: schvalování rizikových akcí přímo v chatu (jako auto režim v Claude Code) — brána místo odmítnutí ukáže v chatu kartu Schválit/Zamítnout a po schválení akci provede … Schválení se váže na konkrétní příkaz a nepřenáší se na další akce, pravidla brány dál platí."

## 1. Context: how it works today

### 1.1 Which engine the chat runs

There are two engines, and the chosen one comes from `resolveRunEngine` in `apps/api/src/chat/chat-session.service.ts:822-825`.

- **opencode (the default since A31).** The live config stores `"aiEngine": "opencode"`. The incident transcript `data/chat/conv_6c971d6a-….jsonl` ran on `engine: opencode` with `engineModel: claude-agent/sonnet`. A turn is `opencode run --agent zibby` with a per-turn config built by `buildOpencodeChatConfig` (`chat-opencode.ts:120-149`). That config denies `*`, allows `shell bash read grep glob list` and `<server>_*`, and loads the plugin `chat/opencode-chat-gate/index.mjs`. The turn runs without `--auto`.
- **Native Claude.** This path runs only when `aiEngine: "claude"` is stored or an `@agent` names it. It uses `claude -p … --settings {"disableAllHooks":true} --permission-mode auto` (`chat-session.service.ts:459-498`). No ZibbyOS gate runs here at all. Claude Code's own auto-mode classifier decides each call, and in `-p` mode it cannot prompt.

### 1.2 How a chat tool call is permission-checked (opencode)

The plugin `apps/api/src/chat/opencode-chat-gate/index.mjs` handles every call in two hooks.

- `permission.hook("evaluate")` (`:135-138`) grants only the allowed tool names.
- `tool.hook("execute.before")` (`:139-142`) calls `chatGateReason()` (`:96-130`) **synchronously** and throws `Blocked by the ZibbyOS gate: …` on any reason.

`chatGateReason` maps the opencode call to Claude events with `toClaudeEvents` (`runner/opencode-gate-plugin/index.mjs:65-120`). It then runs the run gate's own classifier `classifyEvent`, imported in-process from `runner/claude-approval-hook.mjs` and never spawned, because the spawned hook waits. The rules are:
  - A call touching the operator-only surface is refused. `touchesOperatorOnly` (`claude-approval-hook.mjs:1740-1747`) covers the approvals decide API and `~/.config/zibby`.
  - A nested `opencode` / `claude` is refused.
  - `gh.pr_comment` is refused with the hint to use `propose_pr_replies` (`:122-124`).
  - **Any other classified action except `mcp.read` is refused with `CHAT_DELEGATE_REASON`** (`:46-47`, `:125-127`), unless it is in `ZIBBY_CHAT_ALLOW_ACTIONS`.

`ZIBBY_CHAT_ALLOW_ACTIONS` is computed per turn by `chatAllowedActions(floor)` (`chat-opencode.ts:190-205`) through `ChatSessionService.chatAllowActions` (`chat-session.service.ts:306-311`). It holds the actions whose every matching rule is `allow`. It excludes `CHAT_NEVER_ACTIONS = overwrite, move, delete, mcp.read, mcp.write` (`chat-opencode.ts:181`), and it is empty while paused or in an `@agent` turn.

### 1.3 Root cause of today's deny

The chat gate is **fail-fast by design** (A33, documented in `docs/api/chat.md:239-257`). There are three reasons, all stated in the plugin header (`index.mjs:1-5`): a chat turn has no approval-request watcher, no approval card, and a hard 120 s turn (`TURN_TIMEOUT_MS`, `chat-session.service.ts:104`; the kill happens at `:1016-1021`). Because the chat can never wait for a decision, every `ask` / `notify` / `deny` is turned into an immediate refusal with "delegate via create_task".

I reproduced it against the real plugin with node:

| command | `chatGateReason` |
|---|---|
| `gh pr edit 48564 -R shoptet/cms4 --body-file /tmp/pr48564/body.md` | `null` (runs) |
| `mkdir -p /tmp/pr48564 && cat > /tmp/pr48564/body.md <<'EOF' …` | `"overwrite" — … create_task …` |
| `gh pr edit … --body-file - <<'EOF' … EOF` | `null` (runs) |

`gh pr edit` itself is **unclassified**: `classifyGh` returns null for `pr edit` (`claude-approval-hook.mjs:464-471`). What the gate refused in cms4#48564 was the **heredoc write of the body file**, which classifies as `overwrite`. That action is in `CHAT_NEVER_ACTIONS`, so not even an `allow` rule could have let it through. The chat has no free zone (`ZIBBY_FREE_DIRS` is never set), so even a fresh file in `/tmp` counts as an overwrite.

Two consequences for the design:
- The file-effect actions (`overwrite` / `move` / `delete`) and `mcp.write` must become **askable** in chat. Otherwise the originating case stays broken.
- Silently classifying `gh pr edit` is a separate gap, which applies to runs too. See open question Q6.

### 1.4 How runs block on an approval

- **Claude runs.** The PreToolUse hook writes `intent-request.json` and polls for `intent-decision.json` (`claude-approval-hook.mjs:1-53`). `RunnerCore.watchIntentRequest` (`runner-core.ts:1323-1353`) feeds `AgentRunnerService.evaluateIntent` (`agents/agent-runner.service.ts:579-661`). That method calls `gates.evaluate(rules, action)`; `deny` leads to `denyIntent`, `ask` leads to `holdForApproval` plus `approvals.requestApproval`, and anything else leads to `allowIntent`.
- **opencode runs.** `execute.before` **returns a promise** that opencode awaits (`runner/opencode-gate-plugin/index.mjs:300-309`). Gated calls are serialized through a module-level `queue` (`:256-258`) because there is one request file per run.
- **The approvals service** (`approvals/approvals.service.ts`) works as follows:
  - `requestApproval` (`:130-170`) persists a `pending` record and records `approval-requested`.
  - `approve` / `reject` (`:199-267`) run `decide` under a per-id `withPathLock` (`:357-397`), so a decision happens once and a second one gets `ApprovalAlreadyDecidedError` (409). The decision is then routed by `kind` to a registered `ResumableRunner`; `runners.get(kind)?.…` is optional, so a kind with no runner is a no-op.
  - The settled event goes onto `/api/events` scope `approvals`.
- **The approvals HTTP controller** is wholly behind `OperatorTokenGuard` (`approvals.controller.ts:34`), GETs included. A chat plugin therefore **cannot** poll `GET /api/approvals/:id` and needs its own status route behind the chat bearer.

The reusable parts are `execute.before` returning a promise, the serialize queue, `GateEvaluatorService.evaluate(floor, action)` (`gates/gate-evaluator.service.ts:84,176`), and the approvals record, lock and settle path. RunnerCore's file protocol is not needed, because there is no run sandbox.

### 1.5 How the chat UI renders tool events and cards

- A server-side card is pushed with `ChatToolResultRegistry.pushWidget(conversationId, widget)` (`chat/chat-tool-result.registry.ts:63-83`). The call returns `false` when no turn is in flight.
- `runTurn` subscribes with `onWidget` (`chat-session.service.ts:949-958`) and turns each widget into a `show_widget` tool event with a unique `callId`. That event is persisted with the assistant message. `propose_pr_replies` is the precedent: an MCP tool shows a card and the click is the approval (`chat-mcp.controller.ts:669-718`). This matters because opencode reports `tool_use` only **after** a call finishes (`chat-opencode.ts:237-242`), so the card cannot come from the stream.
- The web renders the card through `ChatWidgetCard` (`apps/web/features/zibby/widgets/ChatWidgetCard.tsx`), which has an exhaustive `switch (widget.kind)`.
- `ApprovalsWidgetCard.tsx` already offers inline Schválit / Zamítnout. It uses the same `useApproveMutation` / `useRejectMutation`, a hold-to-confirm for high-risk types and settle-in-place. It lists the **whole pending queue**, though, and loses a decided row on reload. The DS has `ApprovalCard` and `DecisionCard`, both used on queue screens.
- Live refresh works through `runEvents.tsx:194-197`. On scope `approvals` it invalidates the pending list, but not `["approvals","detail",id]`.
- `approvalOrigin` (`apps/web/features/approvals/approval.ts:238-320`) is an exhaustive switch over `kind`. The origin `"chat"` already exists and is used by `machine`.

### 1.6 Other facts the design relies on

- The chat MCP bearer and loopback guard is `ChatMcpAuthGuard` (`chat/chat-mcp-auth.guard.ts`). The token rides in the 0600 turn config, which the model can already `read`/`cat`.
- `ChatModule` (`chat/chat.module.ts`) already imports `GatesModule`. `ApprovalsModule` imports no runner, so importing it is cycle-free. `AutopilotModule` is `@Global`, and `isPaused()` is at `autopilot.service.ts:320`.
- `operator-events.ts:123` turns every `approval-requested` into a Slack `approval-waiting` push.
- Today's prompt texts that point to `create_task` are `OPENCODE_CHAT_NOTE` (`chat-opencode.ts:28-36`), `CHAT_DELEGATE_REASON` (`index.mjs:46-47`) and `chat-persona.ts:63-65`. The `propose_pr_replies` line at `:97` stays.

## 2. Design

Scope: the **opencode chat path only**. The native Claude path is unchanged (see Q1).

### 2.1 Flow

```
model → opencode tool call → chat plugin execute.before (async, serialized)
  local checks (unchanged, sync): tool allowed? operator-only? nested agent? gh.pr_comment?
  classify → no intent or mcp.read → run
  else POST /api/chat/gate?conversationId=…   {tool, input, hash, intent}
        server ChatGateService.check():
          no turn in flight / hash mismatch / paused / raw command names the data dir
            / action "unclassified" → deny
          evaluate(floor, intent): deny → deny (never-tier stays denied)
          decision "allow" WITH an explicit ruleId, not @agent turn, action ∉ CHAT_NEVER_ACTIONS
            → allow (silent)
          everything else (ask, notify, default-allow with no rule) → card:
            approvals.requestApproval({kind:"chat", runId:`${conversationId}/${hash16}`,
              detail: intent.context with preview.cmd overwritten by the FULL raw command})
            → toolResults.pushWidget({kind:"approval", approvalId}) → {decision:"pending", approvalId}
  pending → poll GET /api/chat/gate/:approvalId?conversationId=… every 1 s
          approved → recompute hash of event.input, equal → return (opencode runs THIS call)
          rejected → throw "Blocked … the operator rejected …, do not retry"
          server-side expiry (requestedAt + 300 s, applied in status()) → rejected "expired"
            → throw "no decision in time"
```

### 2.2 Binding to the exact command

- The **held call is the binding**. Approval releases only the one `execute.before` promise that requested it. Nothing is cached, and the model never re-issues the call, so a later identical call asks again. Approve once, run once: `decide` is lock-guarded, and the promise settles once.
- `hash = sha256(tool + "\0" + JSON.stringify(input))`. The plugin computes it and sends it. The server recomputes it from the received `tool` and `input` and refuses a mismatch. The hash sits in `runId` (`<conversationId>/<hash16>`) for audit. After approval, the plugin re-hashes `event.input` and refuses if it changed (TOCTOU).
- The card and `approval.detail` show the **full raw command**, or `server · tool` plus the JSON input for MCP. They are not limited to the top-ranked action, so the operator approves what will actually run. A probe of `classifyEvent` shows that `intent.context` is the enrichment JSON `parseApprovalDetail` reads: `{riskType, summary, consequence, preview:{kind:"command", cmd}}`. An overwrite carries `riskType:"mazani"` (hold-to-confirm), a push `"push"`, an MCP write `"odeslani"`. The server keeps that JSON and **overwrites `preview.cmd` with the full raw command**, so the binding never depends on the hook's rendering. `detail` is stored **untruncated**: `ApprovalSchema.detail` has no max, and the 4000 limit applies to `reason`. A command over 20,000 characters is denied as "too large to review in the chat".
- A forged request is harmless. The model can read the chat bearer and POST to `/api/chat/gate` itself, but that only creates a card. The endpoint executes nothing, and approving a forged card releases no real call.

### 2.3 Gate rules still apply

| floor `evaluate` | chat result |
|---|---|
| `deny` (merge, deploy, purchase, …) | deny, no card |
| `allow` **from an explicit rule** (`ruleId` set) | runs silently. Exceptions: `CHAT_NEVER_ACTIONS` (file effects, `mcp.*`) and `@agent` turns get a card |
| default `allow` (no rule matched, `ruleId` undefined) | card. Today the chat refuses it, so it must not become silent |
| `notify` | card. Today the chat refuses it (Q2) |
| `ask` | card |

Only an explicit allow rule is silent, which matches today's `chatAllowedActions`. Nothing that the chat refuses today runs unasked.

These cases are refused outright and never carded:
- autopilot paused;
- the operator-only surface (unchanged);
- the classifier-choke fallback `{action:"unclassified"}` (`index.mjs:118-121`);
- a command over 20,000 characters;
- nested agents;
- **any** classified call whose raw command or path text contains the ZibbyOS data dir. The check runs on the raw command, whatever the top-ranked action. A chain like `cp x <dataDir>/gate-rules.json && git push` classifies as `git.push` and must still be denied. The paths checked are `dataDir()`, its realpath, and `GATE_RULES_DIR` / `POLICY_DIR` / `APPROVALS_DIR` when set. `gate-rules.json` and the policy file sit directly in `dataDir()` (`gate-rules.module.ts:8`, `gates.module.ts:9`), next to `approvals/`, `credentials/` and `project-secrets/`. Ceiling: this is a substring match, so a relative path after `cd`, or a path assembled at runtime, is not caught. That is the same ceiling as `touchesOperatorOnly`, and the card still shows the command.

`autopilotDecides` is **not** consulted, so a chat card is never auto-approved. This replaces `ZIBBY_CHAT_ALLOW_ACTIONS` and `chatAllowedActions`, which get deleted. The server becomes the single source of truth.

### 2.4 Timeout, reject, chat closed, restart

- **Wait deadline. The server owns it.** `ChatGateService.status()` rejects a pending chat approval older than `CHAT_APPROVAL_WAIT_MS` (300 s) with reason `Expired: no decision in time.` before answering. The plugin then sees `rejected` and denies, so a late click can never record "approved" for a call that never ran (it gets 409). The plugin still has a hard stop at deadline + 30 s in case the API stops answering, and it denies when that fires.
- **Turn timer.** `runTurn` re-arms its kill timer to `CHAT_APPROVAL_WAIT_MS + TURN_TIMEOUT_MS` when an `approval` widget arrives in `onWidget`. Otherwise the 120 s kill would fire mid-wait.
- **Turn end, any path** (reply, error, timeout kill, shutdown). `runTurn` calls `chatGate.settleTurn(conversationId)`, which rejects every pending `kind:"chat"` approval whose runId starts with `${conversationId}/`, with reason `Chat turn ended before a decision.`. A late click then gets 409, and the card shows the decided state.
- **Reject.** The plugin throws `Blocked by the ZibbyOS gate: the operator rejected "<action>". Do not retry it or work around it; ask the operator what to do instead.`
- **Chat closed.** The turn keeps running server-side because it is fire-and-forget. The approval is a normal record, so it is also decidable from `/activity/approvals` and the bridge widget until the deadline. A chat reopened mid-turn sees the card only after the turn persists; the queue has it meanwhile.
- **API restart.** No turn survives a restart. `ChatGateService.onModuleInit` on the primary rejects stale pending `kind:"chat"` approvals (see R9), and `status()` expiry covers the rest.

### 2.5 Card

A new widget kind `{ kind: "approval", approvalId }` gets a small domain composite `ChatApprovalWidgetCard` in `apps/web/features/zibby/widgets/`. It follows `ApprovalsWidgetCard` but for one id: it uses `useApprovalQuery(id)`, the same approve and reject mutations, `HoldButton` for high-risk types, and a DS `CodeBlock` showing `detail`. A decided approval renders its settled state, which also works after a reload. No DS change is needed.

## 3. Tasks (in order)

Each task is one Sonnet session. After each edit, run prettier and eslint on the touched files plus the named test file (per `docs/ops/validation-policy.md`).

### T0. Spike: does a long held call survive the stack? (no code merged; the orchestrator or operator runs it, because it needs the live opencode + claude-agent login, which a sandboxed implementer lacks)
- **Goal.** Show that `opencode run` on `claude-agent/sonnet` tolerates an `execute.before` that awaits 150 s. The worry is the Claude Agent SDK's MCP tool timeout on the `mcp__opencode__*` bridge.
- **How.** Use a throwaway copy of the chat plugin whose `execute.before` does `await new Promise(r => setTimeout(r, 150_000))` for `shell`. Run one turn by hand with the env from `opencodeChatEnv` (see `docs/api/chat.md:189-195`), then repeat with `MCP_TOOL_TIMEOUT=900000` in the env.
- **Acceptance.** Write the outcome into §5 R1 of this file: which env (if any) is needed, and the observed limit. If no setting survives 150 s, stop and re-plan, because the transport assumption breaks.

### T1. Contracts
- **Files.**
  - `libs/contracts/src/approvals/approval.schema.ts`: add `"chat"` to `ApprovalRunKindSchema` with a comment (runId = `<conversationId>/<hash16>`, approve releases the held chat tool call once, reject or timeout refuses it, never auto-approved).
  - `libs/contracts/src/chat/chat.schema.ts`:
    - widget `z.object({ kind: z.literal("approval"), approvalId: z.string().min(1).max(256), ...widgetBase })`;
    - `ChatGateCheckBodySchema` `{ tool: string(1..256), input: unknown, hash: /^[0-9a-f]{64}$/, intent: IntendedActionSchema }`;
    - `ChatGateDecisionSchema` = `{decision:"allow"} | {decision:"deny", reason} | {decision:"pending", approvalId}`;
    - `ChatGateStatusSchema` `{ status: ApprovalStatusSchema }`.
  - `libs/contracts/src/chat/chat.contract.ts`: a separate `chatGateContract` with `POST /chat/gate` (query `conversationId`) and `GET /chat/gate/:approvalId` (query `conversationId`), plus the 401/404 responses. Export it from the index.
- **Tests.** Extend `chat.schema.test.ts` (the widget parses, a bad hash is rejected) and `approvals.contract.test.ts` (`kind:"chat"` parses).
- **Also in T1**, so typecheck stays green, because pre-commit runs tsc:
  - `apps/web/features/approvals/approval.ts` `approvalOrigin`: add `case "chat": return { origin: "chat", ...url };`
  - `ChatWidgetCard.tsx`: add `case "approval": return null;` as a placeholder. T6 replaces it.
- **Acceptance.** `pnpm exec vitest run libs/contracts/src/chat/chat.schema.test.ts libs/contracts/src/approvals` is green, and `pnpm check:types` is green.

### T2. `ChatGateService` (server decision + lifecycle)
- **Files.** New `apps/api/src/chat/chat-gate.service.ts`. Edit `chat.module.ts` (import `ApprovalsModule`, provide the service), and export `CHAT_NEVER_ACTIONS` from `chat-opencode.ts:181` (keep the set; its meaning is now "never silent in chat").
- **API.**
  - `check(conversationId, body)` implements §2.3, in this order:
    1. Recompute the hash (`createHash("sha256")`) and deny on a mismatch.
    2. `intent.action === "unclassified"` → deny. The raw command (`input.command` for `shell`/`bash`, else `JSON.stringify(input)`) longer than 20,000 characters → deny.
    3. `autopilot?.isPaused()` → deny "ZIBBY is paused".
    4. The raw command text contains a protected dir (`dataDir()`, its realpath, `GATE_RULES_DIR` / `POLICY_DIR` / `APPROVALS_DIR`), **whatever the action** → deny.
    5. `const ev = gates.evaluate(await gates.floor(), intent)`. If `ev.decision === "deny"` → deny.
    6. Allow silently **only** when `ev.decision === "allow" && ev.ruleId` and the action is not in `CHAT_NEVER_ACTIONS` and this is not an `@agent` turn (`toolResults.getMentions` is a single agent).
    7. Otherwise build the card:
       - `detail`: parse `intent.context` as JSON, set `preview.cmd` to the full raw command (for MCP, `<server> · <tool> ` + `JSON.stringify(input, null, 2)`), and stringify it untruncated. If `context` is not JSON, build `{ summary: intentApprovalDetail(intent), preview: { kind:"command", cmd } }`.
       - `approvals.requestApproval({ runId: `${conversationId}/${hash.slice(0,16)}`, kind:"chat", skill:"ZIBBY chat", action, detail, risk: action==="delete" ? "high" : "medium" })`.
    8. `toolResults.pushWidget(conversationId, { kind:"approval", approvalId })` is the turn-in-flight check, so no new registry state is needed. If it returns false → `approvals.reject(id, "No chat turn in flight.")` and deny.
  - `status(conversationId, approvalId)`: 404 unless the approval is `kind:"chat"` and the runId starts with `${conversationId}/`. A pending one older than `CHAT_APPROVAL_WAIT_MS` is first rejected with `Expired: no decision in time.` and returned as `rejected`.
  - `settleTurn(conversationId)`.
  - `onModuleInit()`: on the primary instance only, reject pending chat approvals older than `CHAT_APPROVAL_WAIT_MS` (R9). Younger ones expire through `status()` or `settleTurn`.
- **Tests.** New `chat-gate.service.test.ts`, with fakes for the approvals, gates, registry and autopilot. It covers:
  - deny-tier stays denied with no approval created;
  - an explicit-rule allow runs silently;
  - a default allow (no `ruleId`) asks;
  - `notify` asks;
  - `unclassified` denies;
  - a chained `cp x <dataDir>/gate-rules.json && git push` denies;
  - an expired pending approval comes back `rejected` from `status()`, and a later `approve` throws `ApprovalAlreadyDecidedError`;
  - `detail` keeps `riskType` and holds the full, untruncated command;
  - allow on `overwrite` asks;
  - `@agent` allow asks;
  - ask creates exactly one approval and one widget;
  - a hash mismatch denies;
  - paused denies;
  - a data-dir overwrite denies;
  - no turn in flight leaves the approval rejected and returns deny;
  - `settleTurn` rejects only this conversation's pending chat approvals;
  - `onModuleInit` sweeps.
- **Acceptance.** `pnpm exec vitest run apps/api/src/chat/chat-gate.service.test.ts` is green, and no code path creates an approval for a `deny` evaluation.

### T3. `ChatGateController`
- **Files.** New `apps/api/src/chat/chat-gate.controller.ts`, a `@TsRestHandler(chatGateContract)` under `@UseGuards(ChatMcpAuthGuard)` that delegates to `ChatGateService`. Register it in `chat.module.ts` `controllers`.
- **Tests.** New `chat-gate.controller.test.ts`, mirroring `chat-mcp-auth.guard.test.ts` / `chat-mcp.controller.test.ts` setup. It checks a 401 without bearer and from a non-loopback peer, that POST passes the body through, and a GET 404 for another conversation's approval.
- **Acceptance.** The test is green. `curl` with the operator token but no chat bearer gets 401.

### T4. Chat gate plugin waits instead of refusing
- **File.** `apps/api/src/chat/opencode-chat-gate/index.mjs`.
- **Changes.**
  - Split the logic. `chatGateReason` stays **sync** for the local refusals (tool not allowed, operator-only, nested agent, `gh.pr_comment`) and now **returns the classified intent** instead of refusing it: `{ reason } | { intent } | null`.
  - Add `async chatGateCall(tool, input, env, fetchImpl = fetch)`:
    - POST to `ZIBBY_CHAT_GATE_URL` with `Authorization: Bearer ${ZIBBY_CHAT_GATE_TOKEN}`, using `AbortSignal.timeout(10_000)` per request;
    - on `pending`, poll every 1000 ms until the server answers `approved` or `rejected`. The server owns expiry. The plugin's own hard stop is `ZIBBY_CHAT_GATE_DEADLINE_S` (default 330 = server 300 + 30) and denies;
    - once approved, re-hash and compare.
  - Any fetch or parse error, a missing env or a non-2xx response leads to **deny** (fail closed).
  - Serialize `execute.before` through a `queue`, copied from `runner/opencode-gate-plugin/index.mjs:256-309`.
  - Remove `allowedActions` and `ZIBBY_CHAT_ALLOW_ACTIONS`.
  - Replace `CHAT_DELEGATE_REASON` with the reject, timeout and deny texts from §2.4. Keep the `create_task` mention only as "for async work".
  - Rewrite the header comment (`:1-24`).
- **Tests.** Update `apps/api/src/chat/chat-opencode.test.ts`:
  - replace the `/create_task/` refusal assertions (`:208`, `:271`, `:286`, `:295`) with `{ intent }` results;
  - delete the `ZIBBY_CHAT_ALLOW_ACTIONS` case (`:291-298`);
  - add `chatGateCall` cases with a fake `fetchImpl`: allow, deny, pending then approved (resolves), pending then rejected (throws "rejected"), deadline (throws, tiny deadline), input mutated after approval (throws), network error (throws);
  - add a test that two concurrent `before` calls are serialized.
- **Acceptance.** `pnpm exec vitest run apps/api/src/chat/chat-opencode.test.ts` is green. `grep -n ZIBBY_CHAT_ALLOW_ACTIONS apps/api/src` finds nothing.

### T5. Session wiring: env, timer, settle, texts
- **Files.** `apps/api/src/chat/chat-opencode.ts` and `apps/api/src/chat/chat-session.service.ts`. **Not** `chat-persona.ts`: `buildChatPrompt` also feeds the native Claude path, which stays untouched, so all the card wording goes into the opencode-only `OPENCODE_CHAT_NOTE`.
- **Changes.**
  - `opencodeChatEnv` (`chat-opencode.ts:213-233`): drop the `allowActions` parameter. Add `ZIBBY_CHAT_GATE_URL` (`${base}/api/chat/gate?conversationId=…`, built like `mcpBaseUrl` at `chat-session.service.ts:587-590`), `ZIBBY_CHAT_GATE_TOKEN` (= `mcpAuth.bearerToken`), `ZIBBY_CHAT_GATE_DEADLINE_S`, and the env T0 found (e.g. `MCP_TOOL_TIMEOUT`).
  - Delete `chatAllowedActions` (`chat-opencode.ts:183-205`) and its tests, plus `ChatSessionService.chatAllowActions` and the `policy` injection if nothing else uses it (`chat-session.service.ts:301-311`, `:723`).
  - `runTurn`:
    - hoist a `rearm(ms)` out of the timeout promise (`:1007-1021`);
    - in the `onWidget` callback (`:949-958`), call `rearm(CHAT_APPROVAL_WAIT_MS + TURN_TIMEOUT_MS)` when `widget.kind === "approval"`;
    - after `cleanupTurn()` (`:1050`), on every exit path, call `await this.chatGate.settleTurn(conversationId).catch(() => {})`. Add `ChatGateService` as an `@Optional()` constructor param so existing tests construct unchanged.
  - Rewrite `OPENCODE_CHAT_NOTE` (`chat-opencode.ts:28-36`) only (Czech, model-facing): risky steps ask the operator through a card in the chat. A rejection or timeout is final, so do not retry and do not work around it. `create_task` is for asynchronous or long work only. PR thread replies still go through `propose_pr_replies`.
- **Tests.** In `chat-session.service.test.ts`:
  - a turn whose fake process stays silent for longer than 120 s after an `approval` widget is NOT killed (fake timers), while one without the widget is;
  - `settleTurn` is called on normal close, error and timeout.
  - Update the `opencodeChatEnv` tests in `chat-opencode.test.ts`.
- **Acceptance.** Both test files are green. `grep -rn "chatAllowedActions\|chatAllowActions" apps/api/src` finds nothing.

### T6. Web card
- **Files.**
  - new `apps/web/features/zibby/widgets/ChatApprovalWidgetCard.tsx` and `.test.tsx`;
  - `ChatWidgetCard.tsx` (replace T1's `case "approval": return null` with the component);
  - `apps/web/features/runs/runEvents.tsx:194-197` (also invalidate `getApprovalQueryKey(parsed.approvalId)` when present);
  - `apps/web/i18n/messages/{cs,en}.json` (`zibbyWidgets.approval.*`: title "Schválení akce" / "Approve action", approve, reject, approved, rejected, expired, deciding, aria labels).
- **Component.**
  - Use `ChatWidgetFrame` + `ChatWidgetRow` (same as `ApprovalsWidgetCard`), plus DS `CodeBlock` for `detail`.
  - Fetch with `useApprovalQuery(widget.approvalId)` and decide with `useApproveMutation` / `useRejectMutation`, with `body: {}`.
  - Use `HoldButton` when `riskType` is high-risk (`HIGH_RISK_TYPES`).
  - When decided, show the status (a `reason` starting "Chat turn ended" renders as "expired") and no buttons.
  - Declare a `ChatApprovalWidgetCardTestId` enum; tests use `getByTestId`.
- **Tests.**
  - the pending render shows the command and both buttons;
  - approve calls the mutation with the id;
  - an approved approval renders settled with no buttons;
  - a rejected approval with the turn-ended reason renders "expired";
  - extend `ChatWidgetCard.test.tsx` for the new kind;
  - extend `approval.test.ts` for the chat origin.
  - Run them with `pnpm exec vitest run <file> --project web-components` (see memory: web component tests use that project).
- **Acceptance.** The tests are green. No inline `style`, no new DS primitive, and every string goes through `t()`.

### T7. Docs and the live check
- **Files.**
  - `docs/api/chat.md`: rewrite the "Fail-fast gate (A33)" bullet at `:239-257` into an "Inline approval gate" bullet, drop the env line `ZIBBY_CHAT_ALLOW_ACTIONS` at `:194`, and add the two `/api/chat/gate` routes to the route table at the top.
  - `docs/api/approvals.md`: add `chat` to the kinds list.
- **Live check** (the operator's running app, opencode engine). In a chat, ask ZIBBY to write `/tmp/zibby-check.md` with a heredoc:
  1. a card appears;
  2. Approve, and the file exists;
  3. the same command again gets a new card;
  4. Reject, and the model reports the rejection without retrying;
  5. ask for `gh pr merge` and get a deny with no card;
  6. wait out the deadline, and the card shows "expired".
- **Acceptance.** Docs merged. The live results are noted at the end of this file.

## 4. Global Constraints

- Contract first: T1 lands before any implementation that uses the new kind, widget or routes.
- The gate is structural. No env, prompt, tool input or approval can widen a `deny`, and a `deny` never produces a card. Inbound content is data (Law 4).
- An approval releases exactly one held call (the hash-checked one). There is no cache, no "approve similar" and no autopilot auto-approve for `kind:"chat"`.
- Nothing the chat refuses today may run silently. Only an explicit `allow` rule (`ruleId` set) outside `CHAT_NEVER_ACTIONS` is silent.
- The approval `detail` always holds the full, untruncated command the call will run.
- Fail closed everywhere. API unreachable, bad response, missing env, hash mismatch, timeout, turn ended or restart all mean deny, or a pending approval rejected.
- The operator-only surface stays a hard deny in chat (`touchesOperatorOnly`, `pathTouchesOperatorOnly`). The plugin never sees or sends the operator token, and its routes accept only the chat bearer from loopback.
- Reuse: `ApprovalsService` (no new store), `GateEvaluatorService.evaluate`, `ChatToolResultRegistry.pushWidget`, the existing approve and reject mutations, `ChatWidgetFrame`. No new abstraction layer and no new runner registration (`kind:"chat"` needs no `ResumableRunner`, because the plugin polls the record).
- The native Claude chat path is untouched.
- DS-first. The card is a domain composite under `features/zibby/widgets`, with no inline styles. i18n: cs and en keys, cs is the default. Model-facing prompt strings stay Czech, as today.
- Validate incrementally per `docs/ops/validation-policy.md`. Run `pnpm check:types` and `pnpm check:lint` only before hand-off, and lint only touched files inside worktrees (memory: `check:lint` rewrites worktrees).
- Commits: use `git commit -- <paths>` (memory: shared main/worktrees), and run `graphify update .` after code changes.

## 5. Risks

- **R1. The held call times out somewhere else.** Candidates are the Claude Agent SDK's MCP bridge timeout on `claude-agent/*`, an opencode-internal tool timeout, or an idle stream. T0 measures this before any code.
  - **T0 result (2026-11-27, opencode 2.2.7, `claude-agent/sonnet`, `--standalone`): PASSES with no extra env.** A throwaway plugin whose `execute.before` for `shell` awaited the hold and then returned (no throw) was run with the `opencodeChatEnv` shape (scratch config, scratch cwd, no MCP servers, no `MCP_TOOL_TIMEOUT`, no other timeout env).
    - Hold 150 s: shell ran after the hold (log start 12:00:09, end 12:02:39), `T0-OK` came back, turn total 2m38s, exit 0.
    - Hold 450 s: same result, turn total 7m35s, exit 0. No timeout or error at either length.
    - Env needed: none, so `MCP_TOOL_TIMEOUT` was not tried. The limit is not reached at 450 s; the practical limit is higher and unmeasured. The approval deadline must stay at or below about 7 min, the tested length.
    - Caveat: only the built-in `shell` tool was held. A held call on a mounted MCP tool (`mcp.write`) was not tested. The `--server` (live deltas) path was not tested either, only `--standalone`.
- **R2. The turn-timer re-arm leaves a stuck turn running about 7 minutes** instead of 2. That is bounded by the approval deadline, and the process group kill is unchanged.
- **R3. Approval fatigue.** Without a free zone, every temp-file write in chat needs a card; the incident flow would show one card for the body file, and then `gh pr edit` runs unasked. See Q5 and Q6.
- **R4. A card is shown after the fact on reopen.** A chat reopened mid-turn shows the card only when the turn persists. The queue and the bridge widget cover the gap.
- **R5. Approving an obfuscated command.** The card shows the raw command, but the operator can still approve something they misread. The data-dir hard deny protects the gate rules and approvals files. Other destinations rely on the operator's judgment, as in the terminal.
- **R6. Exposure of the chat bearer** to the model's shell (env and the existing 0600 config). The model can create a card, but cannot approve one or release a call. This exposure is unchanged in kind from today.
- **R7. Two pending cards** if opencode issues parallel tool calls. The serialized queue prevents that within one turn.
- **R8. A Slack ping for every chat card**, because `operator-events.ts:123` pushes `approval-requested` (see Q7).
- **R9. Primary/secondary instances share the approvals dir** (`shared/instance-role`, `assertDecidableHere`). The `onModuleInit` sweep on one instance would reject the other instance's live chat approvals. Mitigation in T2: sweep only on the primary (`isPrimaryInstance()`), and only approvals older than `CHAT_APPROVAL_WAIT_MS`. A live one is younger than that by construction.
- **R10. `detail` grows large.** It is stored untruncated, so a 20 kB heredoc becomes a 20 kB approval file and card. That is accepted, because a cut command would break the binding. The 20,000-character cap denies anything larger.
- **R11. Follow-up (review #7, structural half): the operator approve route can be replayed by a same-user shell.** The fix-31 round closed the textual half: the operator-dir check now also runs on the shell `workdir`, on the unquoted command and on each word resolved against the workdir, and opaque forms (`$(…)`, `P=approve; …/$P` assembled by a wrapper, `curl -X POST`) always get a card. What stays open: the chat's opencode process runs as the operator's own user, so a call that reads the operator token by a route the text match can't see (a `cd ~/.config` followed by a relative read, a glob, a runtime-assembled path) and then `POST`s `/api/approvals/:id/approve` is indistinguishable, at the API, from the operator's own click. The approve route should require something a same-user shell cannot replay, for example a web-session-bound `Origin` / CSRF check on the operator routes, or an operator token kept out of the opencode process's reach (a keychain item that needs user presence, or a token the web app holds and the chat env never sees). Until then the token-file read stays the ceiling documented in `docs/api/approvals.md` ("Known ceiling"). Round 2 of the fix also refuses any `cd` / `pushd` into `~/.config` and cards bundled `curl -sX POST` / `-sd` and raw network clients (`http`, `xh`, `nc`, `ncat`, `socat`, `telnet`, `ssh`). Known denylist limit (the reason the structural half matters): the opaque detection is a denylist and will not see code that a classified-harmless command runs for it, e.g. `awk 'BEGIN{system("…")}'`, `git -c alias.x='!sh -c …' x`, `make` with a Makefile the turn wrote, a path composed at runtime (`D=~/.con; cat "${D}fig/zibby/…"`), or `python3 x.py` for a script that already exists on disk.

## 6. Open questions (with the conservative default taken)

- **Q1. Native Claude engine.** Should `aiEngine: "claude"` get inline approvals too, for example via `--permission-prompt-tool` or a PreToolUse hook? **Default: no, unchanged.** It is not the default engine, and `disableAllHooks` plus `auto` mode is a separate design.
- **Q2. `notify`-tier actions, and default `allow` with no matching rule.** Runs let both through, and today's chat refuses both. **Default: a card.** Only an explicit `allow` rule is silent, so nothing that is refused today starts running unasked. Relax this to "as in runs" only if the cards prove noisy.
- **Q3. Paused autopilot.** **Default: deny classified actions, as today.** Pause stops everything new, and resuming needs the operator token.
- **Q4. `@agent` turns.** **Default: the floor rules only, and every non-deny classified action gets a card.** The agent's own tightening rules are not merged; this is no wider than today.
- **Q5. Enabling opencode's `write` / `edit` / `patch` tools, or a chat free zone for the OS temp dir.** **Default: neither.** File rewrites go through the shell and a card, and the toolset stays as is.
- **Q6. Classifying `gh pr edit` / `gh issue edit` / `gh pr close|ready` as `gh.api_write`.** This would change runs too (the `describe` phase edits PR bodies). **Default: out of scope here.** File a separate TODO.
- **Q7. Slack `approval-waiting` ping for `kind:"chat"`.** **Default: leave it** (no diff). It helps when the chat is closed or the turn came from the Slack DM. Suppress it later if it proves noisy.
- **Q8. Approval wait deadline.** **Default: 300 s**, as the server constant `CHAT_APPROVAL_WAIT_MS`. It drives `status()` expiry and the turn re-arm. The plugin's backstop is `ZIBBY_CHAT_GATE_DEADLINE_S` = 330.
- **Q9. `gh.pr_comment` in chat.** **Default: unchanged.** It is still refused locally with the `propose_pr_replies` hint, since that card is the richer approval.
