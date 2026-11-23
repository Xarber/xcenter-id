# Legacy code review

The paths below refer to the original implementation. Its last retained tree is `3bdca936ebd56fbbbce8bf169e0b5d781f860996`.

Baseline `e617758`, branch `main`. The source inventory covers 2,357 tracked files, including 2,093 vendored Font Awesome files. Vendored assets and binaries were inventoried as dependencies or media. Historical account data was classified by path and type without inspecting individual values or validating credentials. Findings use static source inspection.

| Area | Files and relationships |
| --- | --- |
| Application entry point | `index.js` loads `server.cfg` and route rules, starts HTTP/HTTPS, serves the HTML tree, rewrites API requests, invokes file-upload hooks and executes server templates. Optional PeerJS and WebSocket paths are infrastructure capabilities. |
| Public web pages | `HTML/index.html`, `about.html`, `devs.html` and `signedin.html` cover introduction, developer guidance and an example signed-in handoff. Shared HTML modules, styles, icons, translations and JS live in `HTML/assets`. |
| Identity and onboarding | `HTML/auth` exposes sign-in, signup, recovery, token refresh, app linking and sharing. `private/server/authentication` implements signup, signin, recovery, refresh, restore, signout and linking with account files and signed tokens. The OTP helpers and verification settings live under `security`. |
| Account dashboard | `HTML/dashboard/index.html` orchestrates status, verification methods, linked apps, devices and data. Sibling pages cover username, encryption, feedback, support, developer settings and download. `private/server/accmgmt` implements username changes, deletion, backup/export, key changes and support/feedback queues. |
| Data operations | `private/server/data` implements read, write, list, move, remove, upload, download and icons. Linking declares named permissions over app data. Share handlers grant another account read or read/write access. A common shared namespace and public access branches broaden the model. |
| Shared helpers and ancillary routes | `baseAuthAction.njs` and `baseEmbeddedPage.njs` are server templates. `misc` contains app lookup, status, icons, linking state and key/OTP checks. `devs` handlers are scaffolding. The admin dashboard handler is empty and a separate bulk-change handler exists. |
| Persistence | `private/users` models account records, sessions, verification, app metadata, permission maps, files and logs. Account keys sit under `private/keys`. Directory/index metadata supports alternate locations. Updates are filesystem operations across multiple files. No database schema or formal migration runner is present. |
| Interfaces and verification | `api.txt`, developer HTML and browser demos describe handwritten calls with repeated account/app credentials and text responses. `package-lock.json` pins Node dependencies, including optional PeerJS/WebSocket tooling. The npm test target is a placeholder. The baseline contains no native app, CI workflow or verified deployment configuration outside the legacy server settings. |

## Findings and priorities

| Priority | Finding | Replacement action |
| --- | --- | --- |
| Critical if historical records or credentials are live | Account keys, password/session artifacts, logs and exports are tracked. Passwords are stored in a recoverable format and compared after decoding. The storage helper can encode without encryption. | Assess provenance and exposure privately. Invalidate any active legacy sessions and rotate real/reused material with authorization. Fresh passwordless enrollment only. |
| High | Sign-in and app flows expose bearer tokens to browser storage and redirects. The app-link token signing call does not set an explicit expiry. | Use validated OIDC browser flows, short-lived audience-bound access and per-client revocation. |
| High | App identifiers and permission descriptions enter from requests. Data checks are spread across handlers and tied to filesystem path processing and special access modes. | Use registered clients and one deny-by-default authorization layer over typed resource IDs. Verify ownership, audience, live grant, operation and resource on each access. |
| High | Key override handling mutates on-disk key state during requests. File updates and repeated policy logic complicate concurrency and recovery. | Use managed key storage, isolated application roles and transactional writes. |
| Medium | Dynamic server templates, synchronous I/O and duplicated handler logic couple the HTTP server, account logic and storage. | Replace with supported provider and HTTP framework. Keep SDK and consent logic behind a versioned interface. |
| Medium | Bare text responses, repeated metadata, hand-built HTML forms and inconsistent naming make integration error-prone. | Generate a typed API client and provide a single Expo integration and centrally hosted account screens. |

The review does not establish reachability, exploitability, production use or credential validity. Legacy runtime, native behavior, dependency behavior and recovery remain unverified. The [redevelopment plan](AUTHNJS_REDEVELOPMENT_PLAN.md) records the target architecture and migration decision.
