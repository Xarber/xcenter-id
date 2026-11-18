# Account moderation and support

## Administrator controls

The account manager lists profiles on the Admin screen. Selecting a profile opens its own details with session and passkey counts, connected apps, registered apps and icon controls with accessible labels. Missing or unavailable photos retain the default user icon. Photos are served as private, non-cacheable JPEGs through an administrator-only endpoint. The native screen limits each visible search to 40 results. The web screen keeps the existing storage, developer review and alias controls alongside moderation.

Locking restricts account sign-in and access while preserving device sessions. The web and native account managers show a locked state to holders of a preserved session. Unlocking restores sessions that have not expired, and delegated tokens still within their lifetime can become valid again. **Sign out all devices** is a separate administrative action that revokes the account's sessions and pending email sign-in codes. It does not change whether an account is locked. The account holder can [unlink an app](IDENTITY.md) for lasting revocation of delegated access.

Deleting an account requires a recent administrator session and typing the exact username. The administrator roster is protected from both lock and deletion. The operation removes credentials, sessions, profile and photo, verified addresses, and account preferences from the identity database. A tombstone prevents old identities and usernames from being reassigned. Encrypted data in separate services and backup snapshots remains subject to retention and separately authorized erasure. The dashboard deletion is an identity and access operation. The audit records the operator, target ID, action and time, without copying profile content.

Administrators confirm their existing session with a passkey to open protected controls. Confirmation is valid for 30 minutes and is bound to that session. An expired confirmation offers a new passkey confirmation without logout. Native uses the system browser and a one-time request bound to the native session. A browser signed into a different account cannot confirm it. Credential management and username requests can use the same in-session confirmation.

Registered apps can be restricted, restored or deleted from the owner's page. Restriction removes the registration from active client and data checks. Deletion revokes the registration and prevents restoration. An admin can send a plaintext warning directly into the user's mailbox. These actions record the operator and target in the account audit.

## Username changes

The account holder proposes a new username in Profile and explicitly confirms it in the dashboard with a recent session. Requests expire after 24 hours. An administrator with a recent session can approve or reject a confirmed request. Approval checks availability, preserves the stable account ID, re-encrypts the profile, and reserves the old username. The new mailbox address follows the new username. The old address stops receiving mail. The dashboard is the confirmation channel while external OTP delivery is unavailable.

## Feedback and email

Signed-in members can send feedback from Support. Locked accounts retain support-only access through their preserved session, and can use a passkey to regain that restricted session after signing out. They can submit an appeal and read its reply from the locked page. The same session cannot open private Mail, Files, app grants or administrator data. All authorized admins can read the same Support inbox. Each in-app request can receive one response. The response and answered state commit together in the mail database. The reply goes directly into the same account's protected mailbox and never passes through an external SMTP server. Support stores the MIME ciphertext using the existing mailbox key and enforces a bounded per-account request rate and a shared mailbox size limit. An administrator can remove a request. Removal leaves temporary rate-limit evidence.

SMTP intake accepts only exact addresses listed in the protected `supportAddresses` mail setting. Supported values are `support@id.xcenter.it` and `support@xcenter.it`. An SMTP message appears as unverified email in the shared admin inbox, even when its From header names an X-Center account. Admins see plaintext without remote images or active HTML. SMTP intake has a separate storage quota from authenticated feedback. Incoming support abuse, including external inbox saturation, is a residual risk to monitor.

Enable `support@id.xcenter.it` only with working public MX resolution and independently verified mail delivery. The apex MX for `xcenter.it` serves iCloud. Preserve it and use an authorized mailbox-level forward to the support subdomain if the existing provider supports forwarding that address. External SMTP replies need working, authorized outbound delivery and a sender policy. The current implementation delivers replies to signed-in requesters' X-Center mailboxes.


## Administrator roles and verification

Operator IDs in the protected deployment environment remain root administrators. Recently confirmed administrators can grant or remove another account's persisted administrator role; they cannot remove an operator root or alter their own administrator role. Role checks are live on every privileged request and changes are audited. Ordinary navigation/foreground refresh reflects a role change without signing out.

User verification is a separate account flag, not an email ownership proof and not administrator access. Administrators can set it from any active user's detail page. They can also verify pending or active app registrations independently of a developer-review request; that badge never activates a callback or permits an unknown/pending/restricted/revoked client to sign in. Domain activation remains mandatory.

Action buttons now retain icons and visible action names, with a disclosure explaining lock, sign-out-all, deletion, premium aliases and distinct privileges. Both account and app storage support B, KB, MB, GB and TB. Account quotas may range from 1 MB to 100 TB and are logical caps, not disk reservations. Hosted app capacity cannot fall below its current usage.
