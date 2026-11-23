# Consent, delegated files and legacy cleanup

The current source removes the retired Node runtime, HTML tree, original manifests and developer notes. Parent revision `3bdca936ebd56fbbbce8bf169e0b5d781f860996` still contains the original public source. Git history was preserved.

API tests cover a registered Velunivo fixture exporting recent neighborhoods and ride insights and a second registered client requesting both. The test confirms the unlinked rejection, grouped consent for a linked publisher, distinct grants for each collection, and an issued token that honors the selected file scopes and subsequent revocation. File route tests cover authenticated owned-file writes, cross-account denial and recipient read-only access. Storage tests cover publisher opt-in, account ownership, read-only endpoints and removal on opt-out. The dashboard is typechecked. Installed mobile and rendered consent layout require runtime verification.

The production Developer Portal contains a private, pending **Velunivo Consent Test** registration with `https://consent-test.xcenter.it/callback`. It requires a hosted callback, the portal's DNS TXT challenge and activation. The live callback returned 404 and its DNS challenge was absent. Production permission configuration and the live sign-in test remain pending. Synthetic tests do not contact Velunivo or use user files.
