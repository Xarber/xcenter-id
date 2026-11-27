# Proposed Advanced Data Protection

Advanced Data Protection would be an optional account setting. It would separate signing in to the account from unlocking its protected data. The service currently encrypts file content and record payloads at rest with server-held keys. That protects an offline copy of the databases and allows authorized server-side reads. The proposal changes who can decrypt protected content.

## Trusted device and recovery

1. An enrolled X-Center ID client generates the account's protection keys locally. Each enrolled device gets its own signing and key-agreement keys. Keep private device material in the platform's protected key store and use hardware-backed keys where supported.
2. Store encrypted objects and keys wrapped to individual enrolled devices on the server. Authenticate key envelopes against the device, account, object namespace and key version. Keep read and signing roles separate. An X-Center login or a synced passkey alone cannot enroll a decryption key.
3. On a new device, show a pairing request to a trusted device. After local authentication and explicit approval, the trusted device verifies the pairing challenge and wraps the required account keys to the new device's public key. Decryption keys sync automatically once that approval completes. Show recent enrollments and allow device revocation. Revocation prevents future key delivery and triggers rotation for future content.
4. Before enabling protection, generate a high-entropy recovery key on the trusted client. Require the user to save and verify it. Use it to wrap a recovery copy locally and upload only the encrypted envelope. A user who can sign in but has lost all trusted devices must provide that recovery key to unlock protected content. Without either, the data is unrecoverable. Account or email recovery can restore sign-in separately.

## Temporary web access

Keep web access disabled by default. Use a browser-generated ephemeral key pair and bind the approval request to the issuer origin, signed-in account, requesting browser, requested collections and expiration. A signed push message or app notification opens the trusted-device review. The notification contains an opaque request reference. The trusted client confirms details after local authentication and wraps only the keys for the approved collections to that browser.

The browser decrypts in memory for a fixed, short window. Use a dedicated origin with a tightly restricted script policy, exclude persistent browser caches and third-party scripts, and lock on logout, expiry or device revocation. The account root key stays off the web. Browser sessions can copy data they have already decrypted. Expiration stops further access through the service, and cannot recall plaintext. A compromised web deployment could read plaintext during an approved session, so the trusted client should describe what is being granted and the web runtime needs independent review.

Apple supports trusted-device approval for temporary iCloud.com access and transfers individual service keys in a session-bound form. X-Center's browser-local design would aim to keep eligible plaintext out of its server during an approved session. [Apple Platform Security](https://support.apple.com/en-om/guide/security/sec973254c5f/web)

## Third-party apps and compatibility

Third-party apps never receive account keys. Apps with approved access can continue to use server-managed, account-scoped storage through the existing API. End-to-end protected collections require a different interface:

- For writes, encrypt to an authorized account collection public key or use a trusted local broker that writes on behalf of the app.
- For reads, the broker decrypts and returns only the selected data explicitly granted to the app. If the recipient app must see plaintext, it can retain that plaintext. Long-running unattended backend reads require server-readable storage or an explicitly delegated recipient key. They cannot run under strict trusted-device-only access.
- Enforce per-app data and collection grants on the broker as well as the server. An opted-in account must explicitly decide whether an existing app continues in standard storage or moves to compatible protected storage. No automatic plaintext fallback.
- Public profile fields, public records and conventional external SMTP need separate treatment. Encrypt their private at-rest representation where compatible, and clearly identify intentionally public data, routing/index metadata, and data needed by server-operated services. To offer strictly protected mail content, use a distinct client-encrypted mailbox or interoperable sender encryption. A regular SMTP recipient cannot promise end-to-end secrecy for incoming cleartext mail.
- Existing plaintext file hashes reveal equality and can confirm guesses. For protected collections, keep plaintext hashes inside encrypted file metadata and use opaque identifiers or ciphertext digests for server verification. Snapshots copy authenticated ciphertext and retain the corresponding wrapped content keys.

## Implementation sequence

1. Inventory every sensitive data class and key. Add versioned envelope encryption for account-scoped data with per-account data keys and a separate wrapping key from an authorized key store. Keep server-managed keys isolated from database backups. Exercise rotation, schema migration and restore before switching defaults.
2. Pilot trusted devices and recovery with private files and app-backup snapshots. Enrollment, lost-device recovery, interrupted migration, key revocation and rollback need physical-device tests. Make the trust decision and migration state tamper-evident. Retain readable legacy content until the client verifies the migration and recovery path. Protection against the operator begins only after old server-readable copies and applicable backups are retired.
3. Add scoped web approval once the native trust path and independent security review pass. Expand to app records with a documented opt-in compatibility policy, account by account.

This is a design proposal. No protection mode is available through the current release. Key custody and user-facing recovery decisions precede any live migration.

## Developer compatibility declaration

The developer can declare support under their app's storage settings. This defaults to off and is available to owners of active secure registrations after confirmation. Changing the declaration does not migrate anything or grant access. The provider's eligibility check requires the live declaration and an active app link for the account. The future migration endpoint must use that check at commit time, recheck the account's own approval, and stop if an app withdraws compatibility. Existing protected ciphertext must remain recoverable by its owner if an app withdraws support.

### First implementation boundary

Use a separate private vault in the pilot. Sign-in and OAuth continue through the existing issuer. A trusted client generates a random account vault key and device signing/agreement key pairs. Store the device private keys in the native protected store. A device transition signs the issuer, account, previous trust-state digest, new device public keys, purpose, nonce and expiry. The server verifies the signature from a currently enrolled device and atomically advances the trust state. The recipient verifies the signed transition before unwrapping keys. Use standard, independently reviewed cryptographic libraries for key agreement, authenticated key wrapping and signed manifests.

Start with a client-encrypted recovery envelope and a synthetic round trip. The server should validate the package structure, scope and proof. It should never receive raw device keys, vault keys or the recovery phrase. Validate key rotation and client trust-state rollback detection before enabling production accounts. Add protected app records behind the live compatibility and account-consent checks. Preserve the standard container until the newly protected copy has been read back and verified under the user's recovery policy.

## Sandbox pilot

The sandbox API stores an opaque AES-GCM recovery envelope and authenticated encrypted records in a separate SQLite database. The client generates the root key, derives a separate key for each collection using HKDF, and uses P-256 agreement and signed approvals for handoff. The server binds a request to the account session, exact public key, purpose, scope and five-minute expiry. A pending approval is claimed once. Only enrollment can transfer a vault root. Temporary browser requests are limited to the named collection key. A new signer is enrolled only after supplying proof that it holds the private key named by the approving device. The proof path uses synthetic fixtures.

Pilot routes under /account/protected-vault are available only when AUTHNJS_SANDBOX and AUTHNJS_PROTECTED_VAULT_PILOT both equal 1. Production user accounts and standard containers cannot enroll or migrate through this pilot. The user and developer approval to protect app data must both be in place before a production migration contract is added. Sandbox account deletion removes its encrypted vault and requests.

The pilot gives direct testing of the cryptographic and API boundaries. An account-manager interface with device-safe native key persistence, a verified recovery ceremony for reinstall and lost devices, revocation and key rotation, web session lock and approval notifications, and the SDK broker and verified migration workflow are still required before production opt-in.
