# X-Center ID

X-Center ID is a passkey-first identity and consent service with an Expo account manager for web, iOS and Android. The replacement API lives in `services/api` and the account manager in `apps/dashboard`. A separate preview supports synthetic data. The original AuthNJS Node application remains available as a historical baseline.

- [Legacy code review](LEGACY_REVIEW.md) inventories the runtime, user flows, data model, integrations and findings.
- [Replacement API](API.md) documents routes, deployment configuration and API gaps.
- [Security findings](SECURITY.md) covers file boundaries and encryption.
- [Redevelopment plan](AUTHNJS_REDEVELOPMENT_PLAN.md) describes the planned passwordless identity service, Expo SDK and data-sharing contract.
- [Dashboard development and testing](DASHBOARD.md) explains the Expo entry point, data isolation and checks.
- [Testing](TESTING.md) documents source checks, isolated browser verification and device coverage.
- [Navigation and preferences](NAVIGATION.md) describes the sidebar, main tabs and grouped editing.
- [Hosted application data](HOSTED_DATA.md) documents private databases, recipient sharing, public flags and quotas.
- [Integration guide](INTEGRATION.md) covers registering apps, trust, and integrating web and Expo clients.
- [X-Center preview](XCENTER_PREVIEW.md) records how to access and roll back the deployed web shell.
- [X-Center ID integration](IDENTITY.md) covers production OIDC, developer activation and sample apps.
- [Friends and file sharing](FRIENDS.md) covers invitations, grants and revocation.
- [Support and moderation](SUPPORT.md) covers administrator actions, feedback and external intake.
- [Mail delivery](MAIL.md) records SMTP, verification and address reservations.
- [Branding](BRANDING.md) describes the original identity-card icon.
- [Active tasks](ACTIVE_TASKS.md) records current work and pending verification.
- [UADS verification baseline](UADS_REQUIREMENTS.md) describes the current manifest and quality checks.

The legacy entry point is disabled by default and remains `index.js`. Historical developer examples are in `api.txt` and `HTML/devs.html`. Treat the checkout as sensitive because legacy account, log and key material is tracked. Use `apps/dashboard` to develop the replacement locally.
