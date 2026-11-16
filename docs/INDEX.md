# AuthNJS

AuthNJS is an account and consent service concept. The legacy Node application combines sign-in, app linking and a file-based data proxy. The new Expo account manager is an isolated dashboard with synthetic data.

- [Legacy code review](LEGACY_REVIEW.md) inventories the runtime, user flows, data model, integrations and findings.
- [Redevelopment plan](AUTHNJS_REDEVELOPMENT_PLAN.md) describes the planned passwordless identity service, Expo SDK and data-sharing contract.
- [Dashboard development and testing](DASHBOARD.md) explains the Expo entry point, data isolation and checks.
- [Active tasks](ACTIVE_TASKS.md) records current work and pending verification.
- [UADS verification baseline](UADS_REQUIREMENTS.md) describes the current manifest and quality checks.

The legacy entry point is `index.js`. Historical developer examples are in `api.txt` and `HTML/devs.html`. Treat the checkout as sensitive because legacy account, log and key material is tracked. Use `apps/dashboard` to develop the replacement locally.
