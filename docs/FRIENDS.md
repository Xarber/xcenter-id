# Friends and file sharing

Both account clients expose a Friends page. The sender creates a private, single-use invitation code, valid for 15 minutes, and sends it out of band. Only its digest is held in the account database. Both parties need completed X-Center ID profiles. The service has no public user directory for this flow. Creating a new invitation invalidates the old one.

Share an individual file from Files to a specific friend. The friend receives read and download access to that file and no access to its folder or other account data. The encrypted file stays in the owner's storage. Shared downloads force attachment handling and use an opaque share ID scoped to the recipient. Either party can end the friendship, which immediately blocks all future shared downloads. A new friendship has a new identifier and does not restore previous access. Owners can revoke individual shares or delete the file, which removes its grants. Previously downloaded copies remain with the recipient.

The secure boundaries are the authenticated account, active friendship identity, resource ownership and explicit grant. Creation and deletion require the existing account mutation controls. Per-account limits bound friendships and file grants. API tests exercised single use, self-acceptance denial, unauthorized mutation, cross-account access denial, successful download, unfriend, and no access after relink. Browser and device interaction remain to verify.

## App data

The first supported dataset is `saved-place.v1`. The operator registers publishers that have opted in under `friendRecordPublishers` in the protected issuer configuration. Entries use the publisher's registered client `id` and display `name`. The capability defaults off. Reported records include the place label and coordinates, visible to the owner before sharing. A recipient sees the current version of the selected place through Friends. Removing the grant, disconnecting the friendship, deleting the record, disabling its publisher or removing that publisher's approval removes access. App access tokens cannot authorize this route. Automated coverage uses synthetic owners and publishers. No production publisher was enabled.

A 390 px Chrome run against an isolated HTTPS issuer verified invitation, sharing a seeded record from an opted-in publisher, recipient visibility, and removal from the recipient's view after revocation. API coverage also verified recipient isolation and re-friending. Installed native verification remains open.
