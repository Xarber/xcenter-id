# X-Center ID public deployment

The live issuer is https://id.xcenter.it. Current mail rollout: API 5c3187f on18804, Web c27d386, incoming SMTP 5c3187f on25 and mail-client TLS on465/993. See the current receipt below; earlier paragraphs are dated history.  Nginx terminates TLS with the appliance's existing certificate and routes the issuer and both sample hosts to revision d4de743 on loopback 18803 (`xcenter-id-public-d4de743`). The prior version remains running on 18802 for rollback. Restore the two proxy files under `/srv/xcenter/infra/changes/pre-d4de743/`, validate Nginx and reload it to return to that version. Six SQLite online snapshots passed quick_check in `/var/lib/xcenter-id-rollbacks/pre-d4de743.pssz7kwn`. Persistent state and keys remain in their established directories. Preserve the pairwise-subject key and relying-party domain. Earlier dated sections below are historical evidence, not the current deployment description.

The preexisting private account service still uses its own database and hostname. Browser credentials created there are scoped to its relying-party domain. Re-enrollment or a verified account migration is needed for those users on the public origin.

## Verification and rollback

The public revision, signed-out endpoint, OIDC discovery and both sample routes were checked via HTTPS. The root xcenter.it site still returned its existing page. An isolated X-Center staging service exercised real OIDC redirects and callbacks, user-scoped passkey signup, two app-specific subjects, sample notes, shared writes, grant revocation and developer registration. It used a Chrome virtual authenticator. No synthetic account was added to the public database. The initial vhost verification saw a 404 during worker reload and restored the fallback before a second, verified cutover.

To restore the former public fallback, remove only the new enabled id.xcenter.it symlink, validate Nginx and reload it. Preserve the identity container, databases, TLS material and secrets. To switch application revisions, stage a second verified loopback container and repoint the dedicated proxy after preserving a recent snapshot.

## Backups and recovery

The daily timer takes SQLite online snapshots and verifies each copy with SQLite quick_check. The backup script stops when less than 2 GiB is available. The snapshots are protected by mode but share the appliance failure domain. Export them and the separately encrypted secrets to authorized off-device storage before relying on disaster recovery. A synthetic account was recovered in an isolated SQLite snapshot check. Full off-host recovery, key rotation, retention and alerting remain open. A 24-hour snapshot target applies while the timer is operational. No measured full-service RTO has been established.

## Mail

The dedicated SMTP container listens on the appliance and negotiates STARTTLS. Its accepted domains are mail.xcenter.it and hme.xcenter.it. The internet probe still received connection refused on TCP 25 after the service started. The root domain uses iCloud MX and was left in place. The public identity service does not advertise active inbox routing, aliases or verification delivery until an external path and configured sender are verified. Certificate renewal must refresh the protected SMTP copy before internet mail activation.

## Dashboard follow-up

Public Chrome verification for revision 9745b7f covered scrolling at 390×510, Reduced Motion and the public sample sign-in redirect. Staged Chrome verified passkey management, nested file uploads, third-party consent and durable sharing, structured sample records, deletion and app sign-out. The 11 API tests and dashboard typecheck passed. No physical device, external security key or standalone PWA fullscreen validation was performed.

## Native account service and external sample origins

The public sample hostnames are https://notes-id.xcenter.it and https://trips-id.xcenter.it. Both have exact independent OAuth callback registrations. The Nginx sample vhost is deployed separately from the account site. To roll back to 9745b7f, restore the saved account vhost and remove the new sample vhost symlink. Keep the new issuer configuration and databases for recovery.

Public HTTPS checks verified both apps, PKCE starts and exact callback targets. Full signup and linking tests used isolated data and three distinct HTTPS origins. On-appliance test mailboxes verified STARTTLS submission, receipt and refusal of external relay. External receiving and sending remain unavailable.

## Per-app permissions, developer tools and inbox rollout

Revision bd6b402 passed public HTTPS checks on the identity issuer and both sample origins. The public per-app permission route returned the web app, and the admin app inventory rejected unauthenticated access. Browser staging verified per-app grants, profile save feedback, two distinct callback addresses, global developer display name, profile editing, and the fixed inbox composer. Fifteen API tests passed. The production service has no assigned administrator account. Configure stable account IDs in the protected deployment environment before using the admin controls. The previous web and sample vhosts are preserved for rollback.

## 17 November account assignment

The production identity vhost now uses the targeted account patch from c89b65b on loopback port 18801. The web export still identifies bd6b402. The stable account that previously owned `xarberyt` now owns `xarber` and is the only account in the protected administrator allowlist. Neither the user's passkeys nor the stable ID used by app subjects changed. This assignment does not change the existing iCloud address on the apex domain.

Before cutover, the operator took a checked SQLite backup and verified rename, reverse rename and rename again against an isolated copy. The candidate passed issuer discovery and denied anonymous Admin API access before cutover. The first readiness probe hit a connection reset during startup, then the listener was rechecked and passed. After cutover, the stored profile matched the active administrator ID, HTTPS discovery passed and anonymous Admin requests returned 403. The user's authenticated browser session and Admin tab have not been exercised.

Rollback is available from `/srv/xcenter/infra/changes/id.xcenter.it.before-admin-c89b65b.conf` and the preserved `xcenter-id-public` container. To reverse the username itself, use the audited operator tool to re-encrypt with the old username. A direct SQL rename would break authentication of the encrypted profile. The isolated staging container was stopped and the protected backup and original deployment were retained.


## 18 November recovery baseline

Revision 861128c is live for the issuer and both sample hosts through `xcenter-id-public-861128c` on loopback 18802. The older administrator container on 18801 is retained. Six online SQLite snapshots passed quick_check at `/var/lib/xcenter-id-rollbacks/pre-861128c.uZ3ysD`; previous proxy files are under `/srv/xcenter/infra/changes/pre-861128c/`. Root has about 2.2 GiB available and SharedData about 1.1 GiB. The nightly backup guard remains unchanged; these targeted pre-deploy snapshots use the root volume. Mail ingress is now publicly exposed with STARTTLS, but independent external receipt and outbound delivery remain unverified. Preserve iCloud apex MX.


## 18 November account and incoming verification rollout

Production API and Web serve source d4de7438c51dbd9f772acd1720cc7fd2598ccd5e. Its 24 API regressions passed in the actual Linux image before cutover. Public checks passed the exact revision, OIDC issuer, anonymous Admin denial, protected incoming-verification denial, reauthentication and user-detail SPA routes, and both sample roots. A 390px public Chrome check exercised the signed-out routes; authenticated feature testing used isolated accounts only.

SMTP receiver `xcenter-id-smtp-d4de743` initially replaced `xcenter-id-smtp-94ccae4` after a loopback staging check. The protected `inbound-d4de743.json` enables only the incoming verification fallback. Existing delivery flags, keys and iCloud apex MX are preserved. Public STARTTLS, `verify@mail.xcenter.it` acceptance and external relay refusal passed without sending a test message or adding synthetic production records. An independently sent real message is still needed to verify the full public incoming path. External outgoing delivery, authenticated SMTP submission and IMAP remain unfinished.

The first web cutover automatically rolled back because the operator incorrectly requested `/revision.txt` from sample-app origins, which expose their own routes. The corrected check used the issuer revision and sample roots; the second cutover passed. No database restore or production-data deletion occurred. Both active processes had zero restarts and all six live databases passed quick_check. The old receiver emitted two generic listener-error messages whose cause was not recoverable from its logging; bounded connection/listener diagnostics are now deployed without logging addresses or raw SMTP content.


Current SMTP receiver is `xcenter-id-smtp-8bd6b7c`. Its code is from 8bd6b7c and dependencies are mounted read-only from the d4de743 API release; retain that release directory. The intermediate d4de743 and earlier 94ccae4 receiver containers remain stopped for rollback. Stopped temporary stage containers were removed. TLS/recipient/relay checks passed again and the new receiver had zero restarts and no logged errors during observation. The diagnostics stage first failed because a nested mountpoint was missing under the read-only application directory; creating the empty mountpoint fixed staging before production cutover. The infrastructure receipt is `/srv/xcenter/infra/changes/xcenter-id-d4de743.md`.

A fresh appliance TCP25 probe to the Gmail and iCloud MX hosts timed out for both. No independent authenticated relay is configured. These checks do not establish the provider or network device responsible. The next outbound action is to obtain an authorized usable delivery route, then test end-to-end delivery. Incoming fallback is available from Profile and awaits a real message sent by its owner from an external mailbox. SMTP submission and IMAP remain implementation work, separate from the network failure.


## Current relay and mail-client rollout

API: 5c3187f, container xcenter-id-public-5c3187f, loopback18804. Web: c27d386b876ccc8999c90b19004d29c1afd3ab49 in releases/5c3187f/web. SMTP: xcenter-id-smtp-5c3187f, public25. Authenticated submission/IMAP: xcenter-id-clients-5c3187f public465/993. These containers retain the existing Node image and readonly dependency bind from releases/d4de743/api/node_modules; do not remove that release.

Configuration: existing protected mail-receiver/inbound-relay.json for API, protected mail-clients.json for SMTP/client listeners. Relay domains mail.xcenter.it, id.xcenter.it, hme.xcenter.it verified. Generated credential stored only in protected configuration. Open/click tracking observed Off. Two operator probes charged conservatively against the global allowance. Apex xcenter.it iCloud MX unchanged. Explicit id.xcenter.it A/MX added. Router TCP465/993 rules to192.168.1.30 approved, saved and visibly Active.

Recovery: seven checked online snapshots at /var/lib/xcenter-id-rollbacks/pre-mail-5c3187f.nxq70s3m; the new app-data database was snapshotted after initialization. Prior proxy files /srv/xcenter/infra/changes/pre-mail-5c3187f/. Previous API d4de743 remains running18803 and previous SMTP8bd6b7c remains stopped. Restore saved proxies, validate nginx and reload; stop new SMTP and clients and start previous SMTP for rollback. Assess live writes before any database restore; schemas are additive and no production data was deleted.

The first cutover automatically rolled back because its sample-page check expected200. New code intentionally returns404 “Development sample disabled.” following the user’s hidden-sample requirement. Corrected check passed on retry. Public issuer exact web revision, OIDC discovery, anonymous admin/mail access denial, SMTP TLS and relay refusal, and externally accessed465/993 TLS/greetings passed. A real external relay→publicMX→protected support inbox round-trip was confirmed by decrypting only the matching operational probe; the user independently confirmed the previous outgoing probe arrived at iCloud. No synthetic production account or user credential was created.

All three new services had zero restarts during observation. Runtime Linux API suite30/30, isolated 390px Chrome alias/client credential flows, dashboard typecheck/tests/web export passed. Native physical device, real Apple Mail/Thunderbird login, physical FIDO key and full incoming verification with an external owner’s code remain unverified. Nightly backup shared-volume2GiB guard remains unchanged and blocked by low space (about862MB shared free; root2.07GB). No unrelated temporary build data was cleaned. No stable native release published.

### Dashboard rollout on 18 November 2026

The public dashboard and issuer serve revision `310186a5b007f423870d77931aef52c9907152b4` from container `xcenter-id-public-310186a` on loopback port 18805. Public HTTPS confirmed the exact revision, issuer metadata with S256 PKCE, developer guide and profile routes. Signed-out connected-apps requests returned 401. The external sample routes continued returning the expected disabled response. The developer guide rendered in Chrome at 390 px without horizontal overflow. The new container showed zero restarts after rollout.

Pre-cutover SQLite online snapshots passed quick_check for all seven database files in `/var/lib/xcenter-id-rollbacks/pre-dashboard-310186a.bfutr345`. To revert the website and issuer, restore both Nginx site files from `/srv/xcenter/infra/changes/pre-dashboard-310186a`, validate Nginx and reload. The prior API remains on port 18804. Database changes are additive. Evaluate live writes before restoring any snapshot. The nightly shared-volume space constraint still applies.

### App management and storage health rollout

Public revision `d59599567e6375bcf7cff70c40e7025607c66559` runs on loopback 18806. The rollout includes owner and administrator registration deletion, one registered-app list per account, its storage action, and the administrator disk health view. Public revision and discovery passed, signed-out storage inventory returned 403, and the container showed zero restarts. Seven online database snapshots passed quick_check at `/srv/xcenter/data/.xcenter-id-rollbacks/pre-dashboard-d595995.iz51kumc`. Restore the two Nginx files from `/srv/xcenter/infra/changes/pre-dashboard-d595995`, validate and reload Nginx to return traffic to the retained port 18805.

The updater repeatedly left generated Velunivo worktrees after failures. Removed 49 detached temporary builds after checking Git status, generated paths, the updater lock and live symlink targets. The shared volume now has about 38 GiB and 3.0 million file entries free. The updater's loaded `50-build-cleanup.conf` adds a post-exit safety cleanup using `/srv/xcenter/infra/update-services/reclaim-builds.py`. Unit verification and a manual no-op run passed. Its scheduled invocation has not yet been observed. XHDD remains outside the allocation pool.

### Linked profiles and email verification

Public revision `3faa812cf1d9c8d4ab8c86b9a6cee0692f1cc51d` runs on loopback 18807. UADS §24 staging initially failed because the read-only app directory lacked a mount point for its shared dependencies. Creating the empty mount point allowed the same candidate and snapshots to be reused. All seven online snapshots passed quick_check at `/srv/xcenter/data/.xcenter-id-rollbacks/pre-dashboard-3faa812.cdso_xo_`. Restore both Nginx site files from `/srv/xcenter/infra/changes/pre-dashboard-3faa812`, validate and reload Nginx to route back to the retained API on port 18806. The SMTP and IMAP services stayed on their existing revisions.

Public verification covered the exact revision, discovery, signed-out avatar access denial, disabled samples and phone-width Chrome rendering of the developer guide. The production verification relay authenticated over TLS. Isolated Chrome proved `openid` UserInfo and JPEG retrieval, photo access revocation after unlink, and the email flow from an authenticated fixture SMTP submission through browser confirmation and **Check delivery** in another tab. API tests (33), dashboard tests (4), typecheck, web export and the UADS validator passed. There was no fresh check from the original external mailbox or an updated native installation.

### App badges, permissions refresh and offline fallback

Revision `d430aada91713de391f5ef15ab5f578ca63d1b07` is served on loopback 18810. Both the intermediate badge release dbb1d6c and final web release passed staged and public cutover checks. Restore both Nginx site files from `/srv/xcenter/infra/changes/pre-dashboard-d430aad` to return to retained revision dbb1d6c on port 18809. Seven online snapshots passed quick_check at `/srv/xcenter/data/.xcenter-id-rollbacks/pre-dashboard-d430aad.likmainn`. SMTP and IMAP containers kept their existing deployment.

Public HTTPS served the exact revision, offline page and generated worker. OIDC discovery advertised the two display claims and signed-out avatar and connected-app requests were denied. Isolated phone-width Chrome proved app branding refresh on focus and in detail, verified app and profile badges, administrator badges, and the end-to-end Check delivery transition. Six dashboard tests include a simulated worker disconnect/reconnect and assert that account API traffic stays outside the cache. Low local storage prevented Chromium launch for the real offline navigation check. The nightly backup service ran successfully at 04:22 CET and seven nightly snapshots passed their integrity checks. A full application restore was outside this check.

### Consent, Friends and rolling app sessions

Production serves `5ddcb7a0153d3b73253e50f99cb14c71315fb407` on port 18811. Nginx validated both changed site entries and public HTTPS returned the exact revision. Discovery advertises `offline_access`, `friends` and the refresh grant. Signed-out friend and photo requests returned 401, development samples remained disabled, and the rendered developer guide showed the new instructions at phone width. The container reported zero restarts.

The previous release on port 18810 remains available. Restore both saved site files from `/srv/xcenter/infra/changes/pre-dashboard-5ddcb7a`, validate Nginx and reload to roll back. Seven pre-cutover SQLite snapshots passed quick_check at `/srv/xcenter/data/.xcenter-id-rollbacks/pre-dashboard-5ddcb7a.vmc936nb`. The requirements table is additive. SMTP and IMAP kept their prior deployment.

Thirty-six API and six dashboard tests, TypeScript, Expo web export and package validation passed. A low-space API run exercised the existing hosted-data disk guard and passed on rerun with sufficient free space. Isolated Chrome verified app claim requirements, Friends subjects and denial, explicit refresh consent, 10-minute access, 14-day renewal, replay revocation, opt-out and app unlink. The packaged overview rendered its controlled settings and profile with React Native Web. Installed iOS and Android behavior remains unverified.

### Account storage and device sign-in

On 19 November 2026, deployed revision `b4ca80c49ccd6a4b2c6c70d13b1fce58668b1067` to production on loopback 18812. The web export and staged routes passed, and public HTTPS served the exact revision, device entry page and OIDC device authorization discovery. Nginx validated and the candidate reported zero restarts. The previous release remains on 18811. Restore the two site files from `/srv/xcenter/infra/changes/pre-dashboard-b4ca80c`, validate Nginx and reload to roll back. Seven pre-cutover SQLite snapshots passed quick_check at `/srv/xcenter/data/.xcenter-id-rollbacks/pre-dashboard-b4ca80c.507gdu66`. Feature acceptance is with the user. Installed native behavior remains unverified.

### Consent repair, developer access and mail reconnect

On 19 November 2026, deployed web, API and TLS mail-client revision `f465477`. Nginx routes web traffic to 18813. Before cutover, seven online SQLite snapshots passed quick_check in `/srv/xcenter/data/.xcenter-id-rollbacks/pre-dashboard-f465477.8ygd8ljh`. Both public HTTPS and the device navigation links were checked. The public SMTP submission and IMAP ports passed certificate and protocol greeting checks. Both new containers reported zero restarts. Incoming public SMTP port 25 kept its existing service.

Restore both site files from `/srv/xcenter/infra/changes/pre-dashboard-f465477`, validate Nginx and reload to roll the web/API traffic back to loopback 18812. Stop only `xcenter-id-clients-f465477` and start the retained `xcenter-id-clients-5c3187f` to roll back SMTP submission and IMAP. Database changes are additive. Unlink deletes hosted records by design and code rollback does not restore deleted records.

### Dashboard 0.12.0 and mail reconnect compatibility

Production now serves `418f89ccf5b976e7b4c6162764ed42dadeb4e9bc` on loopback 18814. Public HTTPS and issuer discovery passed. SMTP submission and IMAP returned valid TLS certificates and protocol greetings. IMAP advertises SASL LOGIN and ID. Neither production container restarted. Older SMTP logs marked connection errors as listener errors. The updated runtime distinguishes the two. Public inbound SMTP on port 25 kept its existing deployment.

Web/API rollback restores the two Nginx site files from `/srv/xcenter/infra/changes/pre-dashboard-418f89c` and reloads after validation. The previous version remains on 18813. For mail-client rollback, stop `xcenter-id-clients-418f89c` and start `xcenter-id-clients-f465477`. Seven online SQLite snapshots passed quick_check at `/srv/xcenter/data/.xcenter-id-rollbacks/pre-dashboard-418f89c._eowp9h5`. Spark application setup and physical native OTP AutoFill still need verification.

## 23 November dashboard 0.14.0 rollout

HTTPS now serves `fcea370037e7d4c962c921fcf1a4f07bee075a30` from loopback 18815. Staging used copies of the seven verified SQLite snapshots. Prior web/API traffic can be restored by copying the two retained site files from `/srv/xcenter/infra/changes/pre-dashboard-fcea370`, validating Nginx and reloading it. The previous process remains on loopback 18814. Mail listeners kept their existing deployments.

The public release archive, device entry, service worker and OpenID Connect discovery passed. See [verification report](../reports/ONBOARDING_RELEASE_HISTORY_2026-11-23.md).

## 24 November dashboard 0.15.0 rollout

Public HTTPS serves `ddee0106834dc3ecc6b8360f6166a9932489e5e9` on loopback 18817. The candidate passed the staging and public checks with zero restarts. Seven SQLite snapshots passed integrity checks at `/srv/xcenter/data/.xcenter-id-rollbacks/pre-dashboard-ddee010.7zDLqK`. Restore the two site files from `/srv/xcenter/infra/changes/pre-dashboard-ddee010`, validate Nginx and reload to restore the retained web/API process on 18815. The storage additions are backward-compatible. Files finalized by 0.15.0 use chunk records, so validate file availability before serving an older API during a rollback. Deleting an account remains permanent even after a code rollback.

The Velunivo test callback is served by the existing sample host virtual server. Credentials are held only in the protected service configuration. The callback validates an expiring browser-bound state, PKCE and nonce; it discards the returned tokens. Its live success requires an approved sign-in. The established mail services were not redeployed.
