# Additional storage volumes

The 4 TB Toshiba XHDD is an additional destination. The existing volume remains primary and continues serving identity, app registration, quotas and indexes. No accounts or databases have been moved.

## Volume discovery and health

The web admin inventory reports the primary volume and operator-configured additional roots. It reports free bytes, file entry availability and a readable status. It checks for a matching `.xcenter-volume-id` marker on each additional volume, so an empty directory left by an unmount is not mistaken for the drive. The endpoint requires a confirmed admin session and does not return filesystem paths.

`AUTHNJS_STORAGE_VOLUMES` is a protected deployment setting containing an array of `{id,label,root}` objects. Roots are absolute paths inside the service container. An operator must provision and mount a dedicated directory and put its configured ID in the marker on the mounted filesystem itself. The admin health view does not attach disks or change paths.

The appliance currently does not see the HDD. The existing XHDD runbook describes the Ubuntu host's APFS mounts as read-only. Do not reformat, resize, or change the APFS driver to make it writable. Stable writable block storage presented to the guest is needed before storing SQLite data. A read-only disk can be monitored but cannot take allocations.

## Data placement contract

- Keep the account directory, credentials and app registry on the primary disk. Resolve a user or app identity and check access before accessing its selected volume.
- Keep a primary index keyed by account ID for files and client ID for hosted data. Store the volume ID and storage generation there. Existing content stays on the primary volume until a migration explicitly updates its index entry.
- Allocate new account or app storage to an eligible attached volume by an administrator-selected policy. Resolve from server-configured volume IDs only. Use volume-local databases and existing encryption keys. Keep the current quota and isolation checks across volumes.
- If an indexed volume fails its mount check or refuses I/O, return HTTP 503 with “Storage temporarily unavailable.” Preserve the index and existing user and app identities. Use 404 only when authorization or the authoritative index establishes that a resource does not exist. Never silently create a replacement database on the primary disk or on a mountpoint left behind.
- Cross-volume operations must check every affected volume and preserve ownership checks and sharing revocation. Never substitute zero usage, empty results, or missing accounts when a required volume is offline.
- Keep migrations separate from placement. Copy and verify encrypted content, switch the primary index only after validation, and retain the previous copy for rollback. Apply backup, integrity and restore checks to each volume.

Remaining implementation includes indexed placement, per-volume encrypted database opening, admin allocation controls, and tests for disconnect, reconnection, cross-volume authorization, and mount failure at restart. The health inventory alone does not extend storage.
