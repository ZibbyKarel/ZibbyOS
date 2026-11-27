# ZibbyOS desktop

Electron shell that runs the packaged API and web app as child processes.

## Install

Build (from the repo root):

```bash
pnpm desktop:dist
# = pnpm --filter @zibby/desktop stage:resources && pnpm --filter @zibby/desktop build && pnpm --filter @zibby/desktop dist
```

Artifacts land in `apps/desktop/release/`: `ZibbyOS-<version>-arm64.dmg` and `mac-arm64/ZibbyOS.app`.

1. Open the DMG and drag **ZibbyOS** to **Applications**.
2. The app is ad-hoc signed, not notarized. On first launch right-click the app and choose **Open** (then confirm), or run `xattr -cr /Applications/ZibbyOS.app`.

## Releases and updates

A push to main never builds the app. A release is cut explicitly:

```bash
pnpm release:patch   # 0.1.0 → 0.1.1
pnpm release:minor   # 0.1.0 → 0.2.0
pnpm release:major   # 0.1.0 → 1.0.0
```

The script bumps `apps/desktop/package.json`, commits only that file, tags `desktop-v<version>` and pushes main plus the tag. The tag triggers `.github/workflows/desktop-release.yml`: a macOS runner builds the app and publishes a GitHub Release with `ZibbyOS-<v>-arm64.zip`, its `.sha256` and the DMG. Running the workflow by hand (workflow_dispatch) builds main into a **draft** release, which the updater never sees, so you can test the pipeline.

### Releasing

`pnpm release:*` is guarded so a failed build never leaves an orphan tag:

1. **Preflight** (before anything is committed): checks that the local pnpm and Node majors match `packageManager` and `.nvmrc`, then builds a clean temporary worktree of HEAD (`pnpm install --frozen-lockfile` + `pnpm desktop:dist`, same env as CI — uncommitted local files can't make it pass), and asserts `ZibbyOS.app` exists with no `.env*` in its resources. Any failure aborts with nothing tagged. `--skip-preflight` skips it (with a warning); `--dry-run` runs only the preflight, on any branch.
2. **Push**, then **watch CI** via `node apps/desktop/scripts/watch-release.mjs desktop-v<x.y.z>`. If GitHub never acquired a macOS runner (job cancelled, no steps run), it reruns the same tag, up to 3 attempts, instead of burning a version. A real step failure prints the run URL and the failed log tail. On success it checks the release is published with the zip, `.sha256` and DMG. `--no-watch` skips the watch; run `watch-release.mjs` on its own later for an already pushed tag.
3. The workflow publishes as a **draft**, verifies the three assets, and only then flips it to published, so the updater never sees a half-uploaded release. Rerunning a tag is idempotent (existing release assets are overwritten).

Links to anything outside the app (GitHub PRs, Jira, docs) open in the default browser, not inside the ZibbyOS window.

The installed app checks the releases at launch and then every 24 hours, or on demand via **ZibbyOS → Check for Updates…** or **Settings → General → Updates** (whose **Download and install** skips the question below). When a newer `desktop-v*` release exists it asks **Update / Later / Skip This Version**. On **Update** it:

1. downloads the zip, checks the sha256 against the sidecar, unpacks it with `ditto` and verifies the version and the signature;
2. checks the app's own API for `running`/`pending` runs. If any are active it offers **Install When Runs Finish** (polls every 30 s), **Restart Now** or **Cancel**;
3. quits, and a detached script swaps `/Applications/ZibbyOS.app` for the new bundle and relaunches it. The previous bundle is kept at `~/Library/Application Support/ZibbyOS/updates/previous/` for a manual rollback.

There is no Apple Developer ID: the app is ad-hoc signed, so Squirrel/`electron-updater` can't be used (it requires a stable signing identity). The download goes through Node's `fetch`, so the new bundle never gets a quarantine flag and Gatekeeper doesn't block it. The updater only works when the app runs from a writable location such as `/Applications`, not from the DMG. It logs to `~/Library/Logs/ZibbyOS/updater.log`. `ZIBBY_UPDATE_RELEASES_URL` points it at another feed for testing.

CI builds bake `~/Workspace/ZibbyOS` as the source checkout (expanded at runtime); a local `pnpm desktop:dist` bakes the checkout it was built from.

### Where things live

- Data: `~/Library/Application Support/ZibbyOS/data`
- Vault: `~/AI/Vault`
- Logs: `~/Library/Logs/ZibbyOS/{api,web}.log`
- Source checkout: the repo the app was built from (baked into `Contents/Resources/build-info.json`)

### Ports

The app always starts its own API on **4333** and web on **4000**. The dev servers (`pnpm api:dev` on 3333, `pnpm web:dev` on 3000) can run at the same time. If 4333 or 4000 is taken, the app shows an error and quits. Only one instance owns background work: if a live instance on another port holds `data/.instance.lock`, the app refuses to start until that one is stopped. Start order matters: start ZibbyOS first, then the dev server, which then joins as secondary (a dev server started first takes the lock itself).

Closing the window keeps ZibbyOS running in the Dock; Cmd+Q quits it and stops its servers.
