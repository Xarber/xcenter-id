# Active tasks

Assignment opened 16 November 2026. Legacy source baseline `e617758`.

| Order and ID | Priority and request | State | Dependencies, evidence and next action |
| --- | --- | --- | --- |
| 1 AUTHN-001 | Review the legacy repository and save findings | Verified | Static inventory and source findings in [legacy review](LEGACY_REVIEW.md). Runtime and historical credential validity were outside this verification. |
| 2 AUTHN-002 | Start the overhaul with an Expo account dashboard | Implemented | Source under `apps/dashboard`. Type check, sample test, Expo alignment, web export and Chrome sample flows passed. Native runtime remains pending. Next, establish the installed-device test baseline and keep web/PWA work independent of identity setup. |
| 3 AUTHN-003 | Connect the account manager and reusable Expo SDK to passwordless identity and consent | Queued | Determine the issuer and validate the provider with synthetic accounts and external keys. Implement the hosted journeys and typed grant API before wiring live actions. |
| 4 AUTHN-004 | Complete applicable UADS portal, SDK and operational requirements | Queued | Requires the identity/data services and release scope. Track PWA, onboarding screenshots, developer tools, updates, production configuration, accessibility and operations. |
| 5 AUTHN-005 | Validate and release supported artifacts when authorized | Queued | Requires prior implementation and preparation. Apply UADS §8 before starting builds or triggering CI through a push. |
