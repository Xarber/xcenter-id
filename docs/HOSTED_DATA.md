# Hosted application database

The identity service provides an encrypted JSON document database for active, administrator-verified registered apps. This is separate from account files, the historical sample-data store and the internal identity database. Its entry point is `services/api/application-data.mjs`; storage is `app-data.sqlite`, encrypted with a dedicated HKDF-derived key. Never upload or execute arbitrary SQL or database files.

## Namespaces and credentials

An app's user access token needs the `app_data` scope. The server resolves its actual client and account from the provider, checks the active registration, verification and current grant, and never accepts a caller-supplied owner. Public native clients use the same supported data scope with PKCE and verified HTTPS callbacks. Existing legacy saved-place APIs retain their separate confidential-client restriction.

Publishers can create one-time backend keys from the application's database page after passkey confirmation. Only a SHA-256 digest is stored. A key is scoped to one app and its app-owned namespace. It cannot impersonate a user, access user-owned private records or another app's database. Keep it off mobile clients. Replacing or revoking the key takes effect on the next request. Locking/deleting the publisher, restricting/deleting the app or removing app verification disables database access and public reads.

## Record API

- `GET /v1/apps/:client/data/:collection` lists the caller's records and records explicitly shared with that caller in the same app.
- `GET /v1/apps/:client/data/:collection/:id` reads one authorized record.
- `PUT` on a record requires JSON `{data, public, readers?}`. `public` is mandatory; it never defaults to public. `readers` is an optional list of at most 50 recipient usernames, all of whom must already have linked this app.
- `DELETE` removes only the caller's record. Recipient read access does not grant write or deletion permission.
- Writes require `If-Match: "0"` for a new record or the current quoted revision for an existing record. Stale revisions fail rather than overwriting newer data.
- `GET /public/apps/:client/data/:collection[/:publicId]` is anonymous and read-only. Only explicitly public records appear.

Collection and record identifiers are bounded names, not filesystem paths. User-owned, app-owned and cross-app namespaces remain separate. Public/shared IDs are opaque and bound to the app with HMAC, preventing a stable global user identifier from leaking between apps. Each response contains at most 100 records and an optional `nextCursor`; follow it without constructing a cursor manually.

Payloads are limited to 60 KB and requests to 64 KB. Quotas account for payload, a 1 KB record overhead and reader ACL overhead. Administrators can change the service database capacity from 1 MB to 100 TB, down to its current usage. User-owned records follow the account capacity described below. A quota is not a disk reservation; writes also stop when host storage has less than 256 MB free. Service-level capacity planning remains necessary.

AES-256-GCM authenticates the client, owner, collection, ID, revision, public flag and reader list. Explicit reader ACLs are bound into the encrypted record context. An ACL-index alteration alone cannot expose a private record. Ordinary users cannot alter those indexes through the API.

## App-to-app permissions

A verified publisher first enables collection names for sharing. A destination app declares exact `{source, collection, label}` requests through its database settings. Only collections offered by an active verified source can be requested. The consent screen shows both the label and the actual source/collection, with independent switches.

The user must grant each request. Grants permit reads of that user's own authored records, never writes, another user's records, incoming private messages, or app-owned backend records. The provider still requires `app_data`. Permissions can be changed in Permissions; unlinking either app deletes its hosted-data grants. Removing a publisher's shared collection deletes that collection's grants. Restriction/verification checks are live and cannot be bypassed by an existing token.

Management endpoints are `/account/app-storage/:registrationId` and `/account/app-data-permissions`. They require the first-party account session and mutation-origin checks. Backend key and database settings changes require recent passkey confirmation. Only administrators can change capacity.

## Public profiles

`/public/profiles/:username` exposes only name fields the user explicitly publishes. Profile pictures have a separate opt-in and `/public/profiles/:username/avatar` route. No fields are public by default; email and exact birthday are never available through this interface. Lock/deletion hides the profile. Public-profile settings exist on native and web.

## Limits and evidence

The API supports bounded JSON collections and private recipient sharing, not arbitrary SQL, custom server execution, background functions, search indexes or a complete push/real-time messaging service. Apps may poll the authorized collection API. Account recovery, authentication and native package installation remain separate concerns.

Regression tests cover app/user isolation, private/public reads, cross-app grant/revocation, recipient-only messaging, stale writes, backend key isolation/revocation and restriction. Native installed-device use and production verification are tracked separately in ACTIVE_TASKS.md. The new database must be included in online snapshots and restoration with the same protected profile key; never restore the database without its key.

## Account containers and service storage

The normal user-token route stores records in the owner's account container for that app. For example, a user's Velunivo backup uses that user's account capacity and is listed under Velunivo in Account → Storage. The app's backend key uses the separate service database namespace and counts against the app's service quota. Service data includes publisher-owned catalogs and other records owned by the service. A user's record still belongs to the user when they grant reader access or mark it public.

The existing encrypted records already carry the app and owner IDs, so this accounting change preserves IDs, revisions, permissions, payloads, and API paths. Existing records are counted under their owner immediately. Writes that increase usage are blocked when the corresponding quota is full. Reads and deletions remain available. Both namespaces share the encrypted SQLite storage engine. The account quota covers hosted records, account metadata, mail and files. This change does not relocate records to a different physical volume.

Unlinking deletes that app's hosted records and saved places from the user's account, removes its incoming and outgoing grants and ends its account access. The publisher's service records and other users' records are outside that deletion. The app storage capacity editor in Administration changes the publisher service database quota. The developer page shows usage without providing a capacity editor.

## Cross-app consent and read-only account folders

Cross-app requests are grouped under the linked publisher's name and current icon. Requests from an unlinked publisher are declined. The issuer omits switches for them, ignores submitted approvals for them, and checks the link again on every read. Linking the publisher later makes it possible to approve the request. Unlinking clears associated cross-app grants.

Developers can enable **Show this app’s data in the Files browser** in database settings for their own active, verified app. It is off by default. The setting lets account holders browse their own existing records in an icon-labeled, read-only folder and download JSON copies. App-owned service records and records owned by other users stay out of that view. Turning the setting off hides the folder immediately. Editing and deletion still go through the app's storage API and authorization rules.
