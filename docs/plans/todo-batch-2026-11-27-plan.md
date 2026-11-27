# TODO batch 2026-11-27 — plan

Source: vault `~/AI/Vault/projects/ZibbyOS/TODO.md`, open items #7–#28. Branch
`feat/todo-batch-2026-11-27`, worktree `worktrees/todo-batch`. No spec beyond the TODO text
(quoted verbatim per task) and `CLAUDE.md`. Rulings are provisional.

A parallel session works on goals in `worktrees/goals-design` (`feat/goals-design`) and
`worktrees/goals-autonomy` (`feat/goals-autonomy-gate`): goals UI (`apps/web/features/goals`,
`GoalSheet`), goal DS components, autonomy gate and the "Rozhodování cílů" level rename. This
branch merges with theirs later — keep diffs in those areas minimal.

## Global Constraints

- Follow `CLAUDE.md` (DS-first UI, no own Tailwind classes in apps/web, no inline `style` on DOM
  in apps/web, contract-first in `libs/contracts`, one hook per file in `queries/`/`mutations/`,
  no `any`, no `forwardRef`, i18n via next-intl with keys in BOTH `apps/web/i18n/messages/cs.json`
  and `en.json`, DS testid enums + `getByTestId` in tests).
- Work only inside `/Users/zibar/Workspace/ZibbyOS/worktrees/todo-batch`. Never touch the main
  checkout or other worktrees.
- Never run `pnpm check:lint`, `pnpm test`, or repo-wide checks. Per edited file:
  `pnpm exec prettier --write <file>` and `pnpm exec eslint --fix <file>`. Web component tests:
  `pnpm exec vitest run <path> --project web-components`. API tests: scoped to the file.
  Typecheck web: `PATH="$PWD/node_modules/.bin:$PATH" tsc -p apps/web/tsconfig.json --noEmit`;
  api: `PATH="$PWD/node_modules/.bin:$PATH" tsc -p apps/api/tsconfig.json --noEmit`.
- Do NOT commit. Do not run `graphify update`. Leave `.zibby/data`, `graphify-out` alone. The
  controller commits.
- Do not run `next dev`/the app against the real data dir (`~/Library/Application Support/ZibbyOS`).
  If you render, use a scratch `ZIBBY_DATA_DIR` and alternate ports; restore
  `apps/web/next-env.d.ts` and `apps/web/tsconfig.json` afterwards.
- No outward-facing actions (publishing, pushing, posting, signing in to services).
- Smallest change that fully does the item. Reuse what exists; read the code first.

## Task 1: Bridge widgets and dashboard (#11, #12, #13, #14, #15, #23, #25, #29)

TODO text (Czech, operator's words):
- #11 Detail připnuté poznámky na widgetu Kartotéka - při editaci roztáhneme MD editor až na 100% výšky plachty.
- #12 Dashboard - submenu řádek - density selector a "switch layout button" sloužíme do jednoho dropdownu kde budou kategorie options Density s odsazenými položkami "kompaktní/normální/vzdušná" a pod tím option Layouts settings které otevře dialog pro správu dialogů. Velikostně to tlačítko bude jako dnes je density selector a bude mít ikonku jako má layout settings button
- #13 Widget Stav Projektů dostane tlačítko na refresh stejně jako má widget PullRequests - resp každý widget dostane tlačítko refresh a po kliknu si aktualizuje svoje údaje, které ukazuje.
- #14 Widget TODO - upravíme vizuál spodního inputu pro přidání položky - bude přes celou šířku a vysoká bude jeden řádek
- #15 Widget PullRequesty - čísla v hlavičce budou ukazovat jen pullrequesty, které odpovídají filtrům. Momentálně ukažují všechyny PullRequesty v rámci mých týmů
- #23 Widget Pripojené služby - místo "připojeno" budeme ukazovat jen zelenou fajfku nebo červený křížek pokud není připojeno. Použil bych dvousloupcový layout abychom neměli moc prázného místa napravo
- #25 Widget Běhy - po najetí na kartu běhu se mi ukážou na pravé straně místo projektu ovládací prvnky - start/pause a stop abych nemusel otevírat detail když se mi něco pustí automaticky a já to teď chci zaparkovat

Notes: "dialog pro správu dialogů" in #12 means the existing layout-management dialog. #13: put
the refresh affordance in the shared widget chrome so every widget gets it (invalidate that
widget's queries), reusing what the PR widget does today. #25 uses the existing run
pause/resume/stop mutations; icons need accessible labels. Skip the goals widget if refresh
requires touching goals files beyond the shared chrome.

## Task 2: Run detail (#7, #18)

- #7 v detailu běhu rodičobského běhu musíme zobrazit i jednotlivé fáze potomkovských běhů. viz coloring-book-story-bestseller_1795171417300 by měl zobrazovat všechny podfáze z fáze generate i publish. Musíme jen zařídit aby bylo vizuálně jasné, že je to podfáze fáze - navrhuji nějaké odsazení v sidepanelu v levo ale dej pozor ať se tam vejdou subfáze. Taky tam nevidím živý logy ale to bude spojený problém. stejně tak i pro běh model-3d-makerworld_1795171464053
- #18 Zobrazit v detailu běhu pod sekcí Summary info message s artefaktem běhu: u složky cestu a tlačítko pro otevření složky, u souboru cestu k souboru, u PR odkaz na PR (dnes se PR vytvořené kodérem přes gh v detailu běhu nezobrazí)

Notes: the named runs live in the real data dir `~/Library/Application Support/ZibbyOS/data/runs`
— read them READ-ONLY to learn the parent/child shape; never write there. Find why live logs of a
parent don't show child output (likely the log stream follows only the parent run id). For #18,
derive the PR from the run's output/logs if no structured field exists (e.g. a `github.com/.../pull/N`
URL printed by `gh pr create`); "open folder" uses the existing desktop bridge if there is one,
otherwise a copyable path.

## Task 3: Pages (#8, #22, #16, #20, #30)

- #30 Selector pro AI engine v topbaru smažene. výběr AI enginu přesuneme do overlay, které vyjede když chci změnit režim Zibbyho. Tam bude položka "AI engine", která zobrazí k výběru rodiny Enginů a jako poslední tam bude položka "Nastavení" která mě přesměruje na stránku nastavení AI enginů. v topbaru pak také smažeme separator mezi zibby komponentou a ikonkami vpravo
  - Operator clarification: the sheet (plachta) that opens from the topbar AI engine selector is removed as part of #30.

- #8 TopMenu - záložka AI nebude mít ikonku users ale nějakého robota nebo více AI related. Znalosti nebudou znalosti ale "Mozek" s ikonkou mozku
- #22 Detail PR - porřebuju vidět v summary sekci počet komentářů, které jsme přidali MY a kolik z nich bylo resolvnutých a to i pokud jsou resolvnuté všechny. Tak tam můžem dát třeba také zelenoou fajfku
- #16 Uvádět v názvu/popisu schválení vždy to nejdůležitější: u mazání souborů název souboru, u git.force_push název větve; projít ostatní typy schválení a doplnit jim klíčový údaj (cíl, větev, cesta, příkaz)
- #20 Graf na stránce Znalosti je naprosto otřesně pomalý. Celá stránka je zasekaná. Nejspíše to dělají anymace. Zkus to vyladit třeba přes implementaci pomocí webGL nebo treeJS a pokud se nepovede tak anymace zruš

Notes: #20 — measure/identify the cause first (simulation ticks, per-frame React re-render, SVG
node count). Prefer fixing the cause (e.g. no React state per tick, stop the simulation after
cooling, memoize) over a rewrite; dropping animations is the sanctioned fallback. Don't add a new
dependency unless already installed. #22 "MY" = comments authored by the operator or by ZIBBY.

## Task 4: Entity logos (#21)

- #21 Firmy, Týmy i projekty musejí dovolovat v editaci nahrát logo, které se pak bude ukazovat na kartách, ve widgetech a klidně i vyhledávání. Udělej to tak že se logo bude moci změnit po najetí na současné logo v editaci firmy/týmu/projektu

Notes: contract-first. Files are the source of truth: store the image as a file next to the
recipe/entity (or in a defined assets dir), validate type (png/jpg/svg/webp) and size at the API
boundary, sanitize SVG or serve with a safe content type. Show the logo wherever the entity
avatar/initials appear today.

## Task 5: Connected services (#10, #9 definitions only)

- #10 Přidávání připojených služeb z UI (Connected services): dnes jde přidat službu (KDP, MakerWorld, …) jen ručně přes 3 soubory — `recipes/connected-services/<id>.json` (login URL, auth cookies), `recipes/mcp-servers/playwright-<id>.json` (grantOnly Playwright MCP s vlastním browser profilem) a agent/workflow, který ho používá. Widget Connected services na Bridge umí jen zobrazit stav a Connect (přihlášení). Chybí průvodce „Přidat službu“ (název, login URL, cookies pro detekci přihlášení → vygeneruje JSON + MCP server) a stránka/sekce pro správu služeb (viz docs/api/connected-services.md). **UI je nutná podmínka** — bez něj nepřidáváme další služby; blokuje #9 (Printables, Etsy).
- #9 Přidat službu printables jako místo kam se budou také publikovat 3D modely vygenerované workflows a dopublikovat tam ty, které už máme vytvořené a publikované na makerworld. Stejně tak přidat službu Etsy a publikovat tam knížky, které máme publikované na amazon KDP

Notes: scope of #9 here = make Printables and Etsy addable through the new UI (document the
login URLs/cookie names as best known, marked unverified) — do NOT create them in the real
recipes dir and do NOT publish anything. Publishing workflows/recipes for Printables/Etsy are
out of scope (operator decision). Management = list, add, edit, delete (delete behind a confirm
dialog) of connected-service definitions, generating the Playwright MCP server file alongside.

## Task 6: Chat overlay (#19, #17)

- #19 Built-in web browser in the chat side panel: 'show me <url>' opens the site next to the chat. Desktop: Electron WebContentsView in the canvas side slot (own partition, back/reload/address/open-in-browser), chat MCP tool open_url {url} pushes a web card; web/phone fallback = link card opening the system browser. Plain iframe won't work (X-Frame-Options / frame-ancestors).
- #17 Open details launched from chat widgets (note, approval, run, ...) inside the chat overlay like artifacts (split/full panel) so the operator never leaves the chat UI; reuse the Bridge dashboard sheets (TaskSheet, RunSheet, ApprovalSheet, ...) restyled for the overlay instead of building new detail views

Notes: TODO #6 (embedded browser panel) is ticked but no WebContentsView panel exists
(`WebContentsView` only in `apps/desktop/src/findBar.ts`) — build it as part of #19. Start from
`apps/web/features/canvas` (artifact side slot). Only http/https URLs; own session partition;
no navigation to `file:`/custom schemes.

## Task 7: Goals-adjacent (#24, #26, #27, #28 phase 1)

- #24 Tabulka úrovně autonomie - defaultně chci mít všechny řádky sbalené. Pokud nějaké vnořený řádek obsahuje jiné nastavení než rodičovský řádek, pak tento řádek bude vidět ikdyž jsou řádky sbaleny -> logika za tím je "Nezajímá mě to co je stejné ale co se liší"
- #26 Detail Běhu - potřebuju nějak odlišit, že je běh svázaný s cílem - Udělal bych to tak, že tam kde máme zdroj (JIRA/Github PR/...) bych dal název cíle s možností se prokliknout - a nebo tam dáme ještě lépe také vizualizer (kolečko cíle) který bude ukazovat kolik je z cíle splněno
- #27 Nefungují mi asi návrhy automatizací - ve widgetu Návrhy nic nevidím + teď by to měly být návrhy "Automatizací a cílů". Mělo by se hlídat jestli něco nepujde převést i třeba na cíl. Vymysli jak by to mělo fungovat
- #28 Multi-company instances: jedna instance na stroj, více firem; firma jako hranice izolace (machine config `companies`, companyId na automatizacích/projektech/kanálech, run vázaný na jednu firmu, paměť a credentials po firmách). Spec: vault `projects/ZibbyOS/features/multi-company-instances.md` — začít fází 1 (arming filter + UI badge)

Notes: split into sub-dispatches. #27 starts as a bug hunt (why is Návrhy empty), then a small
written design for goal proposals. #28 phase 1 only: `companies: string[]` in machine config
(default = all), arming filter for tick watchers/schedulers/channel listeners/boot recovery,
"belongs to another machine" badge in UI.
