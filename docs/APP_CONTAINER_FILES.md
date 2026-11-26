# Binary files in app storage

Use an app container for backups and other binary data associated with a registered app. Files in a linked account use that account’s quota. An active app can save them with a user access token that has the current `app_data` grant. The app needs its own client ID and can access only its own files for the signed-in user. A verified app can separately save files to its service storage using its backend database key. Service quotas cover both files and records. The same API paths select the namespace from the presented credential.

For a Beat Saber backup, request `app_data` and save the ZIP in the app’s container. Set `browseable: true` so the account holder can download it from the app’s branded folder in Files. Omit the flag to keep the file visible only to the app and to the developer in their own linked account when record browsing is enabled. Browseable files make the app folder appear regardless of the **Show this app’s record container in Files** setting. Account holders outside the developer view can list and download only the Browseable files. Set both `browseable: true` and `editable: true` to also let the account holder rename, replace, or delete that file. Existing files default to read-only dashboard access. Turning the setting off hides the developer’s record collections and private files in their own account. It leaves Browseable files visible. The developer portal can browse the owner’s verified service storage, which stays private.

## HTTP API

Every operation is under `/v1/apps/{clientId}/files`. Send the matching scoped user token or backend database key in `Authorization: Bearer …`. Keep database keys on the backend. The service namespace accepts a false or omitted `browseable` flag.

| Method and suffix | Input | Result |
| --- | --- | --- |
| POST `/uploads` | `{name, size, browseable?, editable?}` with an exact byte count | `201 {id, chunkSize}`. Reserves quota. |
| GET `/uploads/{id}` | Transfer ID | `{id, size, chunkSize, received, committed}`. Use `received` as the next byte offset. |
| PUT `/uploads/{id}` | `{position, content}`. Encode just this chunk as standard base64. | `{received}`. Repeating the same bytes and position is safe before commit. |
| POST `/uploads/{id}` | `{}` after all bytes arrive | `{id}`. Safe to repeat after the server commits. |
| DELETE `/uploads/{id}` | Pending transfer ID | `{ok:true}`. Releases the reservation for an unfinished upload. |
| GET root | Optional `cursor` from the previous page | `{files, nextCursor}`. Each file has `id`, `name`, `size`, `created`, `browseable` and `editable`. |
| GET `/{id}` | Committed file ID | Binary attachment. Stream it to disk for large downloads. |
| PUT `/{id}` | `{browseable: boolean, editable?: boolean}` | `{ok:true}`. User container only. |
| DELETE `/{id}` | Committed file ID | `{ok:true}`. Removes the file and reclaims its charged bytes. |

Use the [SDK guide](https://id.xcenter.it/docs/sdk/app-container-files) for a language-specific start and the [JS and native adapter guide](https://github.com/Xarber/xcenter-id-sdk/blob/70c3b31cafee0052831d1295375845bd97222064/docs/APP_CONTAINER_FILES.md) for a backup example. The app container browser shows record collections first, with binary files below them. Ordinary account folder listings include each direct child folder’s recursive `size` in bytes, computed from committed nested files. Record collection folder sizes use their charged record bytes. The account file browser shows only the sum of the files available in a Browseable-only folder view.

## Security and storage

User and service namespaces have separate lookup keys and quota reservations. Use random file and transfer IDs. Validate filenames as display names with no path separators or control characters, encrypt metadata and chunks at rest, and serve binary downloads as attachments with `nosniff`. Browseable grants read access to the current account. Editable additionally allows the account holder to rename, replace or delete that specific file. The issuer requires both flags for each mutation, including replacement commit. Clearing Browseable also clears Editable. It never creates an anonymous or friend-sharing URL. Private file IDs from another app or account remain unavailable. Recheck live grants after reading upload data and enforce visibility on direct download. Unlinking deletes the app’s user files, unfinished chunks and records. Account deletion clears its container files. The service namespace is unaffected by account unlinking.

Uploads are bounded by remaining quota and disk headroom. The issuer purges unfinished uploads after one hour of inactivity when a new upload starts. Keep the ID and original file until commit. Retry a lost response with status and the saved offset. An incomplete transfer cannot expose file bytes through a download route.

## Account dashboard edits

Account sessions use `/account/app-files/{clientId}` and the account-consent mutation header. Rename with `PUT /{id}` and `{name}`. Delete with `DELETE /{id}`. Replace content with the same chunk loop as a new upload, starting with `POST /uploads` and `{replace: fileId, size}`. Replacement retains the original name and file ID. The original remains readable until the new content is committed. Quota reserves only net growth, while temporary chunks still require disk headroom. Concurrent edits to the original invalidate an unfinished replacement. A file listing exposes `editable` separately from `browseable`. Apps manage visibility with their scoped token, while the account dashboard can change content only when both flags are present.

A replacement stores new encrypted content behind the original file ID. When rolling back the dashboard, keep the API on a revision that understands that content pointer. An older API cannot read files whose content has already been replaced.

## File metadata and content hashes

Personal Files, friend file shares, app containers and verified app service storage return a `sha256` field on every committed binary file entry. It is the 64-character lowercase hexadecimal SHA-256 of the exact download bytes. Renaming, moving or changing visibility preserves the hash. Replacing content changes it when the bytes change, even if the file ID stays the same. Identical content can appear in multiple file entries. Keep both the ID and hash in an app-owned index.

Add `?metadata=1` to a file's regular download URL to retrieve the same JSON descriptor without downloading the bytes. Use the same permission and credential as the download. For shares, use the incoming share ID. For mailbox attachments, the message view lists the hash of each decoded attachment and the attachment download route accepts the same metadata parameter. Folder entries report aggregate size. Records and folders have no binary file digest. Draft uploads become hashable once committed.

JavaScript exposes `user.files.get(id)`, `user.files.getShared(shareId)`, `user.appFiles.get(id)`, and `service.files.get(id)`. Swift, Kotlin and Dart expose `getFile`, `getSharedFile`, and `getAppFile` on the corresponding clients.

The server computes the digest on the first metadata read, streams data in bounded chunks, and stores the digest encrypted alongside its content revision. The first listing of large uncached files can take longer. Download authorization, quota and binary response behavior are preserved. The provider has no hash-search endpoint.
