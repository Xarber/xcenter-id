# AuthNJS replacement API

The legacy Node application is archived in place. Its startup requires an explicit archive opt-in. The replacement under `services/api` ships independently and uses no legacy data files, keys, settings or tokens.

## Implemented HTTP contract

Requests use JSON and a bearer access token. The only unauthenticated route is `GET /health`. The API derives the account from the verified subject and the client from the issuer's authorized-party claim. The production issuer must use a stable shared subject across the registered first-party clients and issue audience-restricted end-user access tokens. The server accepts Keycloak-style RS256 bearer tokens with a maximum age of 10 minutes. Cross-issuer identity mapping, machine tokens and ID tokens are outside this contract.

| Method and route | Action |
| --- | --- |
| GET / POST `/v1/developer/apps` | List your registrations or submit a pending HTTPS registration using an authorized developer token |
| GET `/health` | Process health |
| POST `/v1/records/saved-place` | Create a record in the calling application's namespace with `label`, `latitude` and `longitude` |
| GET `/v1/records/saved-place` | List the app's own records. An optional registered `source` requires a live read grant for the destination. Pages contain up to 100 records. Send the returned `nextCursor` as `after` to continue. |
| PUT `/v1/records/saved-place/{id}` | Replace the calling app's record using its quoted revision in `If-Match` |
| DELETE `/v1/records/saved-place/{id}` | Delete a record from the calling app's own namespace |
| GET `/v1/grants` | The account console lists active grants |
| PUT `/v1/grants` | The account console grants read access for `source`, `destination` and `expires` in Unix milliseconds, up to 30 days ahead |
| DELETE `/v1/grants` | The account console revokes that source/destination grant |

Responses have JSON bodies with `Cache-Control: no-store`. Errors use a stable `error` field. Body size is limited to 8 KiB and each account/app dataset is limited to 1,000 records. The API permits one defined dataset and creates record IDs on the server. Apps do not supply account IDs, filenames or key paths. Authorization and reads use the same database snapshot. In-flight reads may complete after revocation. A recipient can retain copies it already imported.

## Development and configuration

Run `npm ci` and `npm test` from `services/api` with Node 24. A production-like start requires a verified identity provider and managed deployment configuration.

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

## Remaining API and account work

The typed data API is an initial slice. Live passkey signup, recovery and session revocation belong to a validated issuer. Required next work includes production issuer validation, consent capture and reauthentication, request rate limits, change-feed sync and tombstones, account export/deletion, key rotation and recovery, readiness monitoring and deployment evidence. The Expo UI still uses an explicit sample mode. Legacy arbitrary files, shared folders, public files and cross-account sharing require distinct authorization and product decisions before replacing those features.

## Verification

Node 24 API tests passed for account and client isolation, grant creation and revocation, revision conflicts, ciphertext at rest, authentication failures on wrong key or record context, and signed token issuer/audience/time/user-scope validation. The dependency audit returned zero known findings at execution. Tests used synthetic accounts, temporary SQLite storage and a generated signing key. Live identity and deployment remain unverified.

The [integration guide](INTEGRATION.md) defines the issuer policy and operator approval procedure for the live client registry. Production data access requires both an active registered client and the issuer-controlled confidential-client claim.


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
