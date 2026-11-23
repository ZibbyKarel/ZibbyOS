# GitHub API audit log

Every GitHub API call ZibbyOS makes is appended as one JSON line to
`<data root>/logs/github-api-YYYY-MM-DD.ndjson` (UTC date; override the dir with
`ZIBBY_GH_AUDIT_DIR`, disable with `ZIBBY_GH_AUDIT=0`). Code: `apps/api/src/shared/github-audit.ts`.

| `src`      | Source                                                              | Key fields                                                                                                                              |
| ---------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch`    | API process, any `fetch` to `api.github.com` (wrapped in `main.ts`) | `method path query gql status durationMs caller traceId runId token rlResource rlLimit rlRemaining rlUsed rlReset requestId retryAfter` |
| `gh-exec`  | API process, `exec("gh", …)` in `shared/git-exec.ts`                | `args cwd exit durationMs caller`                                                                                                       |
| `agent-gh` | agent `gh`/`glab` Bash calls, via `claude-approval-hook.mjs`        | `cli args action intentDir cwd sessionId` (intent only, no exit code)                                                                   |

`token` is the first 8 hex chars of sha256(token), never the token. `caller` is the top 3 app stack frames.

Not covered: chat sessions (hooks disabled), `spawnClaudeCli` (slack-digest), `gh` run inside
agent scripts, and anything outside ZibbyOS that uses the same GitHub user (your own `gh`,
other Claude sessions). Rate limits are per user, so those still drain the same budget.

## Recipes

```bash
F=~/Library/Application\ Support/ZibbyOS/data/logs/github-api-$(date -u +%F).ndjson

# Calls by caller (who burns the most)
jq -r 'select(.src=="fetch") | .caller[0]' "$F" | sort | uniq -c | sort -rn | head -20

# By bucket + endpoint (search is 30/min, graphql and core are separate)
jq -r 'select(.src=="fetch") | "\(.rlResource) \(.method) \(.path|gsub("/[0-9]+";"/N"))"' "$F" | sort | uniq -c | sort -rn | head -30

# Per hour, per source
jq -r '"\(.ts[0:13]) \(.src)"' "$F" | sort | uniq -c

# Per agent run
jq -r 'select(.runId or .intentDir) | (.runId // .intentDir)' "$F" | sort | uniq -c | sort -rn

# External consumption: jumps in rlUsed larger than our own call count (same token, same bucket)
jq -r 'select(.src=="fetch" and .rlResource=="core") | "\(.token) \(.rlReset) \(.rlUsed) \(.ts)"' "$F" |
  sort -k1,1 -k2,2n -k3,3n | awk '$1==t && $2==r && $3-u>1 {print $4, "gap", $3-u-1} {t=$1; r=$2; u=$3}'
```
