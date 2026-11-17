# Account moderation and support

## Administrator controls

The account manager lists profiles on the Admin screen. Photos are served as private, non-cacheable JPEGs through an administrator-only endpoint. The native screen limits each visible search to 40 results. The web screen keeps the existing storage, developer review and alias controls alongside moderation.

Locking restricts account sign-in and access while preserving device sessions. The web and native account managers show a locked state to holders of a preserved session. Unlocking restores sessions that have not expired, and delegated tokens still within their lifetime can become valid again. **Sign out all devices** is a separate administrative action that revokes the account's sessions and pending email sign-in codes. It does not change whether an account is locked. The account holder can [unlink an app](IDENTITY.md) for lasting revocation of delegated access.

Deleting an account requires a recent administrator session and typing the exact username. The administrator roster is protected from both lock and deletion. The operation removes credentials, sessions, profile and photo, verified addresses, and account preferences from the identity database. A tombstone prevents old identities and usernames from being reassigned. Encrypted data in separate services and backup snapshots remains subject to retention and separately authorized erasure. The dashboard deletion is an identity and access operation. The audit records the operator, target ID, action and time, without copying profile content.

## Username changes

The account holder proposes a new username in Profile and explicitly confirms it in the dashboard with a recent session. Requests expire after 24 hours. An administrator with a recent session can approve or reject a confirmed request. Approval checks availability, preserves the stable account ID, re-encrypts the profile, and reserves the old username. The new mailbox address follows the new username. The old address stops receiving mail. The dashboard is the confirmation channel while external OTP delivery is unavailable.

## Feedback and email

Signed-in members can send feedback from Support. All authorized admins can read the same Support inbox. Each in-app request can receive one response. The response and answered state commit together in the mail database. The reply goes directly into the same account's protected mailbox and never passes through an external SMTP server. Support stores the MIME ciphertext using the existing mailbox key and enforces a bounded per-account request rate and a shared mailbox size limit. An administrator can remove a request. Removal leaves temporary rate-limit evidence.

SMTP intake accepts only exact addresses listed in the protected `supportAddresses` mail setting. Supported values are `support@id.xcenter.it` and `support@xcenter.it`. An SMTP message appears as unverified email in the shared admin inbox, even when its From header names an X-Center account. Admins see plaintext without remote images or active HTML. SMTP intake has a separate storage quota from authenticated feedback. Incoming support abuse, including external inbox saturation, is a residual risk to monitor.

Enable `support@id.xcenter.it` only with working public MX resolution and independently verified mail delivery. The apex MX for `xcenter.it` serves iCloud. Preserve it and use an authorized mailbox-level forward to the support subdomain if the existing provider supports forwarding that address. External SMTP replies need working, authorized outbound delivery and a sender policy. The current implementation delivers replies to signed-in requesters' X-Center mailboxes.
