# Profile and app configuration verification

X-Center ID dashboard 0.16.0 development preview. Scope covers username and mailbox resolution, profile photo storage and selection, confirmation dialogs, and registered-app configuration on dashboard web, iOS and Android.

| Area | Evidence |
| --- | --- |
| Username handling | Browser passes a dotted, underscored and dashed handle through sign-in and username-change forms. Signup's browser pattern accepts it. API tests check normalization, reserved names, unsafe dot placement, and local mailbox resolution. |
| Profile photos | API checks uploaded photos increase account usage, removing a photo frees space, and a rejected oversized account leaves prior usage and profile unchanged. Expo config inspection found the iOS camera and photo-library descriptions and the Android camera permission, plus the Android microphone removal directive. |
| Confirmations | Chromium at 1280 × 800 and 390 × 844 verifies opened confirmation, focus on Cancel, Escape restoring trigger focus without a mutation, and successful confirmation. |
| App configuration | Loopback account service verifies discovery, an authenticated developer portal route, and a full configuration save updating the storage API. API regression rejects other owners, missing confirmation, stale edits and changes to the callback origin. Removing requests revokes old grants. |
| Visual sharing and code editor | Chromium verifies source app and collection selection, title, identifier, description and icon, the submitted sharing configuration, JSON errors, formatting, copy, and a confirmed edit that updates callbacks. Genuine captures use local synthetic fixtures. |
| Static and regression checks | 47 API and 15 dashboard tests passed. Dashboard type check, Expo dependency alignment, generated changelog and UADS structure passed. |
| Platform and production boundaries | Physical camera, library and file-picker checks, native dialog interaction and external mailbox routing remain unverified. Production is still 0.15.2. The preview uses the existing release and signing configuration. |

Relevant UADS requirements include UADS-PLAT-001, UADS-UI-001, UADS-SEC-001, UADS-DATA-001, UADS-QA-001 and UADS-REL-001. The Chromium regression and screenshot script is `apps/dashboard/scripts/capture-release-web.py`. Current configuration and import format are documented in [Hosted data](../HOSTED_DATA.md#developer-permissions-and-configuration).

The [four-platform native preview](https://github.com/Xarber/xcenter-id/actions/runs/45378307774) was submitted for commit `308747cd8ed9d4649955bf6bd66125966ca1ae25`. The iOS device and simulator jobs and Android AAB job started. The Android APK job was queued at the first observed check. Dashboard and API dependency audits each reported zero vulnerabilities. Build completion, install and native interaction evidence remain open at this checkpoint.
