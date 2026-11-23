# Friends and file sharing

Both account clients expose a Friends page. The sender creates a private, single-use invitation code, valid for 15 minutes, and sends it out of band. Only its digest is held in the account database. Both parties need completed X-Center ID profiles. The service has no public user directory for this flow. Creating a new invitation invalidates the old one.

Share an individual file from Files to a specific friend. The friend receives read and download access to that file and no access to its folder or other account data. The encrypted file stays in the owner's storage. Shared downloads force attachment handling and use an opaque share ID scoped to the recipient. Either party can end the friendship, which immediately blocks all future shared downloads. A new friendship has a new identifier and does not restore previous access. Owners can revoke individual shares or delete the file, which removes its grants. Previously downloaded copies remain with the recipient.

The secure boundaries are the authenticated account, active friendship identity, resource ownership and explicit grant. Creation and deletion require the existing account mutation controls. Per-account limits bound friendships and file grants. API tests exercised single use, self-acceptance denial, unauthorized mutation, cross-account access denial, successful download, unfriend, and no access after relink. Browser and device interaction remain to verify.

## App data

The first supported dataset is `saved-place.v1`. The operator registers publishers that have opted in under `friendRecordPublishers` in the protected issuer configuration. Entries use the publisher's registered client `id` and display `name`. The capability defaults off. Reported records include the place label and coordinates, visible to the owner before sharing. A recipient sees the current version of the selected place through Friends. Removing the grant, disconnecting the friendship, deleting the record, disabling its publisher or removing that publisher's approval removes access. App access tokens cannot authorize this route. Automated coverage uses synthetic owners and publishers. No production publisher was enabled.

A 390 px Chrome run against an isolated HTTPS issuer verified invitation, sharing a seeded record from an opted-in publisher, recipient visibility, and removal from the recipient's view after revocation. API coverage also verified recipient isolation and re-friending. Installed native verification remains open.

## Friend import by linked apps

An app can request the optional `friends` scope and call `GET /v1/profile/friends` with its user access token. The list contains accepted friends only. A friend gets a `sub` in the response only while that person has linked the same registration. Match it to that registration’s OIDC subject to reconnect the two product accounts. The endpoint derives the registration from the token and does not accept a client ID from the caller. Removing the friendship, unlinking, or withdrawing consent changes subsequent responses.

Isolated Chrome verified the scope, accepted-friend list, same-registration subject, omission for an unlinked friend, and denial after consent withdrawal. Production deployment is pending the saved checkpoint.

## File permissions for registered apps

Registered apps can request optional OIDC scopes for the Files area. Each starts off until the account holder opts in. Linked apps can review and revoke these permissions from the individual app's **Permissions** page. An app changing what it requests should start another browser authorization with `prompt=consent`.

| Scope | Access using the registered app's user access token |
| --- | --- |
| `files_read` | List the account holder's own folders and file metadata with `GET /v1/files?folder=ID`. Omit the folder for the root. Download an owned file with `GET /v1/files/ID`. |
| `files_write` | Includes owned-file reads. Upload with `POST /v1/files` and JSON `{name, content, folder}`, where content is canonical base64 and folder is optional. Create a folder with `POST /v1/files/folders` and `{name, folder}`. Delete owned files or empty folders with `DELETE /v1/files/ID` or `DELETE /v1/files/folders/ID`. |
| `shared_files_read` | List incoming shared files with `GET /v1/files/shared`. Download by recipient-specific share ID with `GET /v1/files/shared/ID`. |

File lists and attachments use the same size, quota and filename rules as the dashboard. These endpoints accept OAuth bearer tokens from a relying-party backend or a native client. They do not accept an account browser cookie or an app storage backend key. An issued token needs both the matching scope and a current grant. Unlinking, account restrictions and revocation block subsequent file access. Removing a friendship or share blocks further access by the recipient and its apps. Third-party apps cannot grant or revoke a share. An app with write permission can permanently delete the account holder's own files. A recipient or recipient app cannot edit the source file. Previously downloaded copies remain with the receiving app.
