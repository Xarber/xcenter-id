# Friends and file sharing

Both account clients expose a Friends page. The sender creates a private, single-use invitation code, valid for 15 minutes, and sends it out of band. Only its digest is held in the account database. Both parties need completed X-Center ID profiles. The service has no public user directory for this flow. Creating a new invitation invalidates the old one.

Share an individual file from Files to a specific friend. The friend receives read and download access to that file and no access to its folder or other account data. The encrypted file stays in the owner's storage. Shared downloads force attachment handling and use an opaque share ID scoped to the recipient. Either party can end the friendship, which immediately blocks all future shared downloads. A new friendship has a new identifier and does not restore previous access. Owners can revoke individual shares or delete the file, which removes its grants. Previously downloaded copies remain with the recipient.

The secure boundaries are the authenticated account, active friendship identity, resource ownership and explicit grant. Creation and deletion require the existing account mutation controls. Per-account limits bound friendships and file grants. API tests exercised single use, self-acceptance denial, unauthorized mutation, cross-account access denial, successful download, unfriend, and no access after relink. Browser and device interaction remain to verify.

Sharing app data is a separate pending extension. It requires a source app opt-in for a versioned dataset, explicit recipient approval of the requested data, and server checks for both the publisher and the recipient. App access tokens keep their existing account scope.
