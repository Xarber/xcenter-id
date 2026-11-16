# AuthNJS

AuthNJS is an account and consent service concept. The legacy Node application combines sign-in, app linking and a file-based data proxy. The new Expo account manager is an isolated dashboard with synthetic data.

- [Legacy code review](LEGACY_REVIEW.md) inventories the runtime, user flows, data model, integrations and findings.
- [Replacement API](API.md) documents routes, deployment configuration and API gaps.
- [Security findings](SECURITY.md) covers file boundaries and encryption.
- [Redevelopment plan](AUTHNJS_REDEVELOPMENT_PLAN.md) describes the planned passwordless identity service, Expo SDK and data-sharing contract.
- [Dashboard development and testing](DASHBOARD.md) explains the Expo entry point, data isolation and checks.
- [Integration guide](INTEGRATION.md) covers registering apps, trust, and integrating web and Expo clients.
- [X-Center preview](XCENTER_PREVIEW.md) records how to access and roll back the deployed web shell.
- [Active tasks](ACTIVE_TASKS.md) records current work and pending verification.
- [UADS verification baseline](UADS_REQUIREMENTS.md) describes the current manifest and quality checks.

The legacy entry point is disabled by default and remains `index.js`. Historical developer examples are in `api.txt` and `HTML/devs.html`. Treat the checkout as sensitive because legacy account, log and key material is tracked. Use `apps/dashboard` to develop the replacement locally.
