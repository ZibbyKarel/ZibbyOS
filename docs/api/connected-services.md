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

- `GET /api/connected-services` -> `ConnectedService[]` (`{ id, name, landingUrl, loginUrl, iconUrl?, profile, status }`,
  `status` is `connected` | `disconnected`).
- `POST /api/connected-services` `{ name, loginUrl, landingUrl?, iconUrl? }` -> 201 `ConnectedService`, 409 when the
  id is taken. `id` = `profile` = the name slugged to `[a-z0-9-]` (diacritics dropped), `landingUrl` defaults to the
  origin of `loginUrl`, `authCookies` is `[]`. Writes `<dir>/<id>.json` atomically (tmp + rename).
- `PATCH /api/connected-services/:id` `{ name?, loginUrl?, landingUrl?, iconUrl? }` -> 200 `ConnectedService`, 404 for
  an unknown id. Rewrites the definition's own file; `id`, `profile` and `authCookies` never change. `iconUrl: null`
  clears the icon.
- `POST /api/connected-services/:id/connect` -> 200 `ConnectedService`, 404 for an unknown id.

Settings → Accounts adds and edits services (name, login URL, icon URL). Without `iconUrl` the UI shows
`<landingUrl origin>/favicon.ico`, and the generic plug icon when that fails to load.

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
any long-lived cookie counts, a consent cookie included. For an exact check, fill in `authCookies` in the file. Missing DB or any sqlite failure = `disconnected` (failures other than a
missing DB are logged).

## Connect

Creates the profile dir if missing, then
`open -na "Google Chrome" --args --use-mock-keychain --password-store=basic --user-data-dir=<profile> <loginUrl>`
via `execFile` (no shell). The mock keychain matters: playwright-mcp launches the agents' Chrome with
`--use-mock-keychain`, and cookies encrypted with the real Keychain key would be unreadable to the agents.
Returns the service with its currently read status; the UI re-polls the list after the operator signs in.

A Chrome profile can be open in one process only. The operator must close the sign-in window before an agent
uses the profile, and Connect while an agent drives the profile hands the URL to the automated window.
