# Connected services

Websites ZIBBY's agents drive through Playwright MCP servers (Amazon KDP, MakerWorld, ...), each with its own
persistent Chrome profile at `<zibbyHome>/browser-profiles/<profile>`. The operator signs in once by hand in
plain system Chrome (Google sign-in is blocked in automated browsers); this module shows which services are
signed in and opens that login window.

| Piece    | File                                                                   |
| -------- | ---------------------------------------------------------------------- |
| Contract | `libs/contracts/src/connected-services/` (`connectedServicesContract`) |
| Service  | `apps/api/src/connected-services/connected-services.service.ts`        |

## Endpoints

- `GET /api/connected-services` -> `ConnectedService[]` (`{ id, name, landingUrl, loginUrl, iconUrl?, profile, authCookies, status }`,
  `status` is `connected` | `disconnected`).
- `POST /api/connected-services` `{ name, loginUrl, landingUrl?, iconUrl?, authCookies? }` -> 201 `ConnectedService`, 409
  when the id is taken. `id` = `profile` = the name slugged to `[a-z0-9-]` (diacritics dropped), `landingUrl` defaults to
  the origin of `loginUrl`, `authCookies` (`[{ host, names[] }]`, `names` non-empty) defaults to `[]`. Writes
  `<dir>/<id>.json` atomically (tmp + rename) and the Playwright MCP server (below).
- `PATCH /api/connected-services/:id` `{ name?, loginUrl?, landingUrl?, iconUrl?, authCookies? }` -> 200
  `ConnectedService`, 404 for an unknown id. Rewrites the definition's own file; `id` and `profile` never change.
  `iconUrl: null` clears the icon; `authCookies` replaces the whole list (`[]` = the any-cookie fallback). The generated
  MCP server is not touched.
- `DELETE /api/connected-services/:id` -> 204, 404 for an unknown id. Removes the definition file and the MCP server file
  the create generated (only that one: a definition without the `mcpServer` marker, e.g. a hand-written KDP, keeps its
  MCP file). **The browser profile directory is never deleted**, the sign-in stays on disk.
- `POST /api/connected-services/:id/connect` -> 200 `ConnectedService`, 404 for an unknown id.

Settings -> Accounts lists, adds, edits (name, login URL, icon URL, auth cookies as `host: name1, name2` lines) and
deletes services (confirm dialog that says the profile stays). The Bridge "Connected services" widget has an "Add
service" button opening the same dialog. Without `iconUrl` the UI shows `<landingUrl origin>/favicon.ico`, and the
generic plug icon when that fails to load.

## Generated MCP server

Create also writes `recipesDir("mcp-servers")/playwright-<id>.json` (override: `MCP_DIR`), the same shape as the
hand-made `playwright-kdp` / `playwright-makerworld`: stdio, `grantOnly: true`, `enabled: true`, args
`--user-data-dir <browser-profiles>/<profile> --allow-unrestricted-file-access`. `command` is `playwright-mcp` next to
the running node binary when present, else `playwright-mcp` from PATH. An existing file is never overwritten: the
definition is still created, the file is left untouched (logged) and not marked as owned, so delete will not remove it.
A create that fails part-way leaves no orphan MCP file behind. An agent still has to be granted the server
(`playwright-<id>`) to use it.

## Known services

Addable through the UI, not created in the recipes dir. Cookie names are UNVERIFIED, leave `authCookies` empty
(the fallback rule below covers it) until a real sign-in shows them.

| Service    | Name       | Login URL                          | Auth cookies                                                                                |
| ---------- | ---------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Printables | Printables | `https://www.printables.com/login` | UNVERIFIED (landing `https://www.printables.com`), empty                                    |
| Etsy       | Etsy       | `https://www.etsy.com/signin`      | UNVERIFIED (landing `https://www.etsy.com`; maybe `.etsy.com`: `uaid`, `user_prefs`), empty |

Publishing workflows for them are out of scope.

## Definitions

One JSON per service in `recipesDir("connected-services")` (override: `CONNECTED_SERVICES_DIR`). Profiles root:
`<zibbyHome>/browser-profiles` (override: `BROWSER_PROFILES_DIR`).

```json
{
  "id": "kdp",
  "name": "Amazon KDP",
  "landingUrl": "https://kdp.amazon.com",
  "loginUrl": "https://kdp.amazon.com/signin",
  "iconUrl": "https://kdp.amazon.com/favicon.ico",
  "profile": "kdp",
  "authCookies": [{ "host": ".amazon.com", "names": ["at-main", "sess-at-main"] }]
}
```

Validated with Zod; invalid files are logged and skipped, a missing dir is an empty list. `profile` must be a
plain directory name (no path separators).

## Status

No browser launch, no Keychain. The profile's `Default/Cookies` SQLite DB is read with `/usr/bin/sqlite3`
(`-readonly`, `file:...?immutable=1`, so Chrome's lock does not matter). `connected` = a cookie whose
`host_key` equals an `authCookies[].host` (the leading dot is ignored on both sides) and whose name is in that
entry's `names`, with `has_expires = 1` and `expires_utc` in the future (Chrome epoch: microseconds since 1601).
Session-only cookies never count.

A definition with empty `authCookies` (an operator-added service; its cookie names are unknown) is `connected` when
any persistent, unexpired cookie's host equals or is a subdomain of the `loginUrl` or `landingUrl` hostname. Ceiling:
any long-lived cookie counts, a consent cookie included. For an exact check, fill in `authCookies` (UI or file). Missing DB or any sqlite failure = `disconnected` (failures other than a
missing DB are logged).

## Connect

Creates the profile dir if missing, then
`open -na "Google Chrome" --args --use-mock-keychain --password-store=basic --user-data-dir=<profile> <loginUrl>`
via `execFile` (no shell). The mock keychain matters: playwright-mcp launches the agents' Chrome with
`--use-mock-keychain`, and cookies encrypted with the real Keychain key would be unreadable to the agents.
Returns the service with its currently read status; the UI re-polls the list after the operator signs in.

A Chrome profile can be open in one process only. The operator must close the sign-in window before an agent
uses the profile, and Connect while an agent drives the profile hands the URL to the automated window.
