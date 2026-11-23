# Device sign-in and Files verification

Source `db11c12` on `testing` implements six device-code slots, a dedicated native QR screen and confirmation, file and folder renaming, inline folder creation, multi-file upload, and branded app usage entries for users and administrators. A developer can manage app-container records only when the container belongs to that developer's signed-in account. Existing ACLs and public flags are preserved during edits. The general Files listing and admin inventory expose no record payloads.

- API suite passed 40 tests. Coverage includes file and folder rename with unchanged bytes and IDs, delegated scopes, publisher-only app records, write intent, revision checks, and read denial for ordinary users and administrators. The existing issuer test confirms that device codes require a separate approval.
- Dashboard typecheck and 13 tests passed, including pasted device codes and partial upload failures. The UADS validator passed.
- Expo exports succeeded for web, iOS and Android. A 390-pixel Chrome fixture exercised inline folder creation and renaming, two-file selection, file rename, and an app usage row without a content link. The issuer's browser form showed six code slots, one accessible input, and an explicit Continue control. Physical QR scanning and installed iOS/Android UI remain unverified.
- The local, source, and standalone public SDK integration skill copies passed validation. The icon guidance is on SDK main at `af87cfc`. The SDK file-scope changes are on SDK `testing` at `6c4855a`. The live issuer must advertise the scopes before products request them.

## Live consent test

The portal shows the private test registration active and verified. Public DNS returns its verification TXT record, and the issuer opens a sign-in interaction for its registered client and exact callback. Both Velunivo exports exist. The portal draft specifies Recent neighborhoods and Ride insights. Saving it requires the developer's passkey, and the portal had not reported a successful save at the checkpoint. The test callback still returned HTTP 404. Live data-sharing approval and token exchange were not exercised. Do not record confidential credentials, account data, or approval URLs in source or test logs.
