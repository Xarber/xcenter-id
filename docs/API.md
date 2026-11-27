# AuthNJS replacement API

The maintained identity and storage provider runs under `services/api`. Use the [hosted developer guide](https://id.xcenter.it/docs) and [SDK reference](https://id.xcenter.it/docs/sdk) for app integration.

## Implemented HTTP contracts

| Feature | Entry points |
| --- | --- |
| Sign-in and device authorization | Discover the issuer's OAuth, token, UserInfo and device endpoints via `/.well-known/openid-configuration`. See [identity](IDENTITY.md). |
| App records and cross-app reads | `/v1/apps/:client/data`. See [hosted app data](HOSTED_DATA.md). |
| Files and metadata | [Account file transfers](#dashboard-file-transfers) and [app container files](APP_CONTAINER_FILES.md). |
| Incremental backups | `/v1/apps/:client/backups`. See [backup operations and SHA-256 metadata](APP_SNAPSHOTS.md). |
| Friends and shared files | See [Friends and delegated sharing](FRIENDS.md). |
| Encryption | [Encryption and ADP](https://id.xcenter.it/docs/encryption). |
| Registered-app settings | [Developer permissions and configuration](HOSTED_DATA.md#developer-permissions-and-configuration). |

## Development and configuration

Run `npm ci` and `npm test` from `services/api` with Node 24. See the [deployment runbook](operations/XCENTER_ID_PRODUCTION.md) for the maintained production issuer. The following variables belong to the standalone service entry point and isolated compatibility testing.

| Variable | Meaning |
| --- | --- |
| `AUTHNJS_ISSUER` | Exact HTTPS issuer |
| `AUTHNJS_JWKS_URL` | Trusted issuer key-set location over HTTPS |
| `AUTHNJS_USER_SCOPE` | Scope issued exclusively for authenticated end-user grants |
| `AUTHNJS_AUDIENCE` | AuthNJS data service OAuth audience |
| `AUTHNJS_CONSOLE_CLIENT` | Registered account console client ID |
| `AUTHNJS_DEVELOPER_CLIENT` | Separate confidential developer portal client |
| `AUTHNJS_DATA_KEY_HEX` | 32-byte encryption key injected from secret storage |
| `AUTHNJS_DATA_DIR` | Dedicated, operator-owned storage directory outside the checkout |
| `AUTHNJS_PORT` | Loopback port, default 8787 |

The service listens on loopback and requires a trusted TLS reverse proxy for remote access. A single SQLite database is appropriate for local development and the isolated slice. Cross-host storage, multi-instance deployment, credentials, rate limiting and operational controls need review before launch.

## Verification and upcoming work

The [test guide](TESTING.md) describes current regression checks and [active tasks](ACTIVE_TASKS.md) records unresolved work. [Deployment evidence](operations/XCENTER_ID_PRODUCTION.md) distinguishes isolated tests from live production checks.

## Hosted app database and public profiles

[HOSTED_DATA.md](HOSTED_DATA.md) is the maintained contract for `/v1/apps/:client/data`, read-only `/public/apps/:client/data`, `/account/app-storage/:registrationId`, `/account/app-data-permissions` and public name/photo profiles. `/docs` publishes installation and integration guidance. These APIs do not expose the identity database or accept SQL.

### Linked sign-in grants

`GET /account/connected-apps/:client/permissions` returns `{permissions}` for the first-party account's linked app. Each permission has a `scope`, `enabled`, `required`, `canEnable`, and, for a shared email, `address`. `PUT` takes `{scope, enabled}` and requires an authenticated first-party session and mutation intent. The server only permits changes to previously encountered, optional scopes. Changing access cannot withdraw claims the app previously received. Restore or new access may require app reauthorization to issue a token containing that scope.

`GET/POST /v1/developer/profile` supports an optional `githubProfile` HTTPS URL to a single GitHub username. Omitting it preserves the current value, and an empty string clears it. Changing it or the display name resets developer verification. The admin developer review uses this profile link, while the registered application's own repository remains separate.

## Dashboard file transfers

The first-party dashboard starts a transfer with `POST /account/files/uploads` and a JSON object with `name`, `size` in bytes, and optional `folder`. The response contains the transfer ID and `chunkSize`. Send consecutive chunks to `PUT /account/files/uploads/:id` with the byte `position` and base64 `content`. Commit with `POST /account/files/uploads/:id` after every byte is received. Cancel with `DELETE /account/files/uploads/:id`. Repeating an already accepted identical chunk or successful commit is safe. Idle reservations expire after one hour. A small storage floor is charged for an empty file. Existing inline uploads and downloads remain compatible.

`GET /account/files/destinations` lists owned folders and their parents for the move picker. `PATCH /account/files/:id` and `PATCH /account/files/folders/:id` accept a destination `folder`, with `null` for the root. Folder moves reject cycles and paths deeper than the existing folder limit.

`GET /account/switcher` lists browser sessions available in that browser, and `POST /account/switcher` selects one of the protected cookie’s slots. `POST /account/delete` requires a recent authentication and the active profile username as `confirmation`. It immediately revokes access and schedules durable cleanup across stores. The appliance operator identity cannot be removed until its role is transferred.

For folder deletion, the current dashboard sends `DELETE /account/files/folders/:id?recursive=1` after confirmation. The transaction removes the owned subtree, shares, data chunks and unfinished reservations. The legacy request and delegated clients retain empty-folder deletion.

The signed-in browser can start a second login or signup by including `addAccount: true` and the first-party request header in both phases. The passkey challenge and any emailed code are bound to the current browser session. Successful sign-in parks the previous session within the existing three-account cap.

### Administration list pagination

`GET /account/admin/accounts?page=2&size=25&q=example` requires a recent administrator session and returns `{accounts,total,page}`. Sizes are 10, 25, 50 and 100. The optional filter matches part of a username, ignoring case. Out-of-range page numbers select the last available page. Older clients that omit paging fields still receive the previous capped response.
