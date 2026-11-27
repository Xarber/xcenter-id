# Incremental app snapshots

In Developer Apps → Storage, the developer opts in and sets a positive compatibility version. Restore has a separate switch. Turning backups off stops new snapshots, app requests and restores. The account owner can still list or delete existing snapshots.

The user opens **Apps → Backups** to create a backup and grant permission for the app to manage backups. Both controls are independent. Apps use their linked user's `app_data` token. Third-party and service-storage credentials cannot manage these snapshots.

## Partial snapshot policy

Set `selection.records` to `null` for all records or to an array of allowed collections and exact `collection/recordId` selectors. An empty list excludes records. Select `none`, `all`, `browseable` or `editable` in `selection.files`. Browseable includes read-only and editable files. Editable includes only files with both flags set.

Each snapshot records its selection. Restore requires the same active policy and compatibility version. For filtered records and files, restore updates the items that were captured and preserves other items, including newer items outside that captured subset. In a category configured for all data, restore replaces the entire category. If a captured file now falls outside the current visibility filter, the restore is refused without modifying live data.

## Storage

Each snapshot represents a point-in-time view of the user's committed records and files in one app container. Unchanged encrypted file chunks and record versions are referenced by new snapshots. File content counts once across live storage and all snapshots. A replaced or deleted file counts once if any retained snapshot still uses its old contents. A later snapshot with identical files adds only manifest overhead. File and record payloads stay encrypted under the same account and app boundaries. Two independently uploaded files are distinct content versions, even if their plaintext hashes match.

Each snapshot can be restored independently. The listed size describes all data covered by that snapshot. Account quota includes retained versions and manifest overhead. Each account may keep up to 100 snapshots per app. Other accounts, other app containers, pending transfers, ordinary account files and service storage are outside the snapshot. Unlinking the app or deleting the account removes its snapshots.

## Restore

An app can request a restore. The user confirms or dismisses it in the shared dashboard at `https://id.xcenter.it/apps/{clientId}/backups`. The dashboard requires passkey confirmation for restore. The server rechecks the developer's policy and exact compatibility version. A rollback snapshot is created before changing live data. If there is insufficient quota or any operation fails, the restore rolls back without replacing live data.

Restored records receive fresh revisions. Existing visibility and recipients are preserved where a record still exists. Deleted records come back as private. A snapshot never restores account or cross-app permission grants. An app can delete the snapshots it requested. Account owners can delete any snapshot in their container.

## Delegated API

| Method | Route | Result |
| --- | --- | --- |
| GET | `/v1/apps/{clientId}/backups` | `{policy, allowApp, snapshots}` |
| POST | `/v1/apps/{clientId}/backups` | 201 with the new snapshot descriptor |
| DELETE | `/v1/apps/{clientId}/backups/{id}` | `{ok:true}`, for an app-created snapshot |
| POST | `/v1/apps/{clientId}/backups/{id}/restore` | 202 with `{pending:true}` |

Snapshot descriptors include `id`, `version`, `created` (Unix milliseconds), `bytes`, `records`, `files`, `appCreated` `requested` (Unix milliseconds or null), and `selection`. JavaScript exposes `user.appBackups` with `list`, `create`, `delete`, `requestRestore` and `managementURL`. Swift, Kotlin and Dart offer `listAppBackups`, `createAppBackup`, `deleteAppBackup`, and `requestAppBackupRestore`.

Snapshots use the existing server-managed encryption. See the [Advanced Data Protection proposal](ADVANCED_DATA_PROTECTION.md) for a future device-managed alternative.
