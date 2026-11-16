# Active tasks

Assignment opened 16 November 2026. Legacy source baseline `e617758`.

| Order and ID | Priority and request | State | Dependencies, evidence and next action |
| --- | --- | --- | --- |
| 1 AUTHN-001 | Review the legacy repository and save findings | Verified | Static inventory and source findings in [legacy review](LEGACY_REVIEW.md). Runtime and historical credential validity were outside this verification. |
| 2 AUTHN-002 | Start the overhaul with an Expo account dashboard | Implemented | Source under `apps/dashboard`. Type check, sample test, Expo alignment, web export and Chrome sample flows passed. Native runtime remains pending. Next, establish the installed-device test baseline and keep web/PWA work independent of identity setup. |
| 3 AUTHN-003 | Connect the account manager and reusable Expo SDK to passwordless identity and consent | Queued | Determine the issuer and validate the provider with synthetic accounts and external keys. Implement the hosted journeys and typed grant API before wiring live actions. |
| 4 AUTHN-004 | Complete applicable UADS portal, SDK and operational requirements | Queued | Requires the identity/data services and release scope. Track PWA, onboarding screenshots, developer tools, updates, production configuration, accessibility and operations. |
| 5 AUTHN-005 | Validate and release supported artifacts when authorized | Queued | Requires prior implementation and preparation. Apply UADS §8 before starting builds or triggering CI through a push. |
| 6 AUTHN-006 | Critical priority, review file saving and account encryption | Verified | [Security findings](SECURITY.md). Static review established unsafe path construction and unauthenticated or optional encryption. Legacy runtime disabled by default. |
| 7 AUTHN-007 | Finish the secure replacement API | Implemented | Typed records, optimistic revisions, quota, pagination and read-only grants implemented. Synthetic isolation, encryption and signed-token tests passed. Account lifecycle, quota, sync, rotation and operational gates remain pending. Depends on AUTHN-003 for end-to-end identity verification. |
| 8 AUTHN-008 | Redesign the web page with Expo and preserve the old site | Implemented | New Expo root landing and PWA export. Legacy pages preserved in place. Chrome verified first entry, return, manifest and offline reload. Actual PWA installation, update UI and distribution remain pending. |

| 9 AUTHN-009 | Stage AuthNJS on X-Center for testing | Implemented | Private web preview served over HTTPS at 6882dae. Browser verified developer navigation and account entry. Live API and account preview need a validated issuer and gateway. See [preview runbook](XCENTER_PREVIEW.md). |
| 10 AUTHN-010 | Developer registration and app identity enforcement | Implemented | Pending registry, operator approval and API checks pass synthetic tests. Expo page requires authenticated gateway, trusted issuance policy and live verification. |
| 11 AUTHN-011 | Reusable React Native package and integration documentation | Implemented | Dashboard consumes the package. Native browser PKCE helper passes SDK 58 type checking. Live callback, backend token exchange, session storage and physical-device verification remain open. See [integration guide](INTEGRATION.md). |
| 12 AUTHN-012 | Build native artifacts under §8 and §9 | Queued | [Run 43853292379](https://github.com/Xarber/AuthNJS/actions/runs/43853292379) submitted for 0762414. iOS jobs started. Both Android jobs stopped at signing validation before compiling. A subsequent SDK change needs its own verification when ready. Live identity remains an independent external dependency. |

AUTHN-006 and the storage portion of AUTHN-007 moved ahead of live identity integration to address the requested security and data-integrity priority.

The Expo web export was the smallest build needed to verify the redesigned public shell and offline behavior under §8. Live issuer verification and native/release builds remain open. The next action is to configure and test an isolated passwordless issuer with two registered clients and a distinct account console client. No Docker executable is available on this host.

| 13 AUTHN-013 | Deploy a real passkey-first identity service and account settings | In Progress | Same-origin account backend and Expo Web passkey settings implemented. Verify enrollment and sign-in with a synthetic account in isolated storage before cutover. Email enrollment is unavailable until an ownership-verification transport is configured. |
| 14 AUTHN-014 | Brand X-Center ID and add native tabs | Implemented | Editable icon, native tab bar and shared branding added. Run web and source checks, then validate native artifacts and device behavior. |
