# Mozek + KB registry — design (2026-11-17)

Operator goal: the vault is called **mozek** (the brain) everywhere, ZibbyOS knows that from
the first token of every run/chat, and connected knowledge bases (team KBs) are found by
walking the brain: brain index → `knowledge-bases` registry → KB root index → article.
One source of truth for connected KBs: a registry note inside the brain.

## Decisions

| # | Decision | Why |
|---|---|---|
| M1 | **mozek = the vault** (`~/Documents/AI/Vault`, `resolveVaultDir()`). Code identifiers (`VaultService`, `VAULT_DIR`, `dest: vault`, route `/knowledge/vault`) stay; only prose, prompts, cs UI strings and docs say "mozek". | Renaming identifiers is churn with no behaviour change. |
| M2 | Registry note `knowledge/knowledge-bases.md` (id `knowledge-bases`, kebab like every other note id). YAML frontmatter `kbs:` is the machine truth; the body is a generated, human-readable table with wikilink-free absolute paths. | Law 2 — files are truth; readable in Obsidian. |
| M3 | Registry entry: `id` (slug), `name`, `path` (abs), `gitRemote?`, `readOnly: true` (literal), `root` (default `wiki/INDEX.md`), `context` (default `team-context.md`, optional), `domain` (`work`\|`personal`, default `work`), `description` (one line: what questions it answers), `teamId?`, `companyId?`. Zod schema in `libs/contracts`. | Each KB declares its own entry files; domain keeps company KBs out of personal runs. |
| M4 | Teams no longer store `knowledgeBase` in `_teams.json`. `Team.knowledgeBase` in the API contract keeps its shape (`{kind:"vault", path, gitRemote?, readOnly:true}`) but is **derived** from the registry entry whose `teamId` matches. Team update with `knowledgeBase` writes/clears the registry entry. Web untouched. | One truth, zero web churn. `kind:"vault"` literal is a known naming wart — left for later. |
| M5 | One-time migration at API boot: a team in `_teams.json` with `knowledgeBase` and no registry entry for that `teamId` → entry `{id: teamId, teamId, companyId, ...}` written, field removed from the manifest. Idempotent. | Today only `devrel`. |
| M6 | Registry read is fail-safe: missing/unparseable/invalid file → empty registry + a warning log (and vault-lint reports it); never crashes a run. Writes are atomic (tmp + rename) and go through `VaultService` so `updated` + vault-log stay consistent. `readOnly` in the file is data, not a permission — no code path writes into a KB except the existing gated `kb-answer` inbox + PR workflow. | iCloud vault; Law 1/4. |
| M7 | `KbReaderService` and `team-kb-grounding` take `root`/`context` from the entry instead of hardcoded `wiki/INDEX.md` / `team-context.md`. | Each KB brings its own layout. |
| M8 | Retrieval: (a) runs — grounding gets a short `### Mozek → knowledge bases` list (id, name, description) of registry KBs visible in the run's domain; team-KB section stays as today. (b) chat (operator, unscoped like recall F8) gets MCP tools `list_knowledge_bases`, `search_knowledge_base(kbId, query)`, `read_knowledge_base_note(kbId, path)` backed by `KbReaderService`. KB content stays wrapped in the untrusted-data envelope. | "Ask about DevRel → brain → KB → answer" without a team-scoped run. |
| M9 | "mozek" definition injected at startup: `OPERATING_CONTRACT` (runs) and `CHAT_PERSONA_PROMPT` (chat) each carry one short paragraph: *mozek = the operator's Obsidian vault (second brain); entry point `INDEX`; connected KBs listed in `knowledge-bases`; read KB rules (`AGENTS.md`) before using a KB.* Grounding header becomes `## Grounding (mozek)`. | Model never has to look the term up. |
| M10 | Brain layout (minimal moves — code hardcodes `daily/`, `knowledge/`, `projects/`, root = memory tier): add root `AGENTS.md` (operating schema: folder roles + access rules, like the DevRel KB), root `CLAUDE.md` shim → `AGENTS.md`, root `INDEX.md` (entry MOC: north-star, knowledge-bases, zibby-index, slack-index, department MOCs, projects). Move `features/*` → `projects/ZibbyOS/features/` (no code reference). No numeric prefixes, no `inbox/`/`sources/` until something consumes them. | Guide's roles without breaking hardcoded paths. |
| M11 | Recipes (`~/Documents/AI/ZibbyOS/recipes`, not in git — backed up first) and docs/CLAUDE.md prose: "vault" → "mozek" where it names the operator's brain; `kb-librarian` / `team-kb-ingest` get the KB path from the registry entry. | Workflows and agents speak the same language. |

Backup of the brain before changes: `~/Documents/AI/backups/vault-pre-mozek-2026-11-17.tgz`.
