# X-Center ID public deployment

The live issuer is https://id.xcenter.it. Nginx terminates TLS with the appliance's existing certificate and routes the issuer and both sample hosts to revision d4de743 on loopback 18803 (`xcenter-id-public-d4de743`). The prior version remains running on 18802 for rollback. Restore the two proxy files under `/srv/xcenter/infra/changes/pre-d4de743/`, validate Nginx and reload it to return to that version. Six SQLite online snapshots passed quick_check in `/var/lib/xcenter-id-rollbacks/pre-d4de743.pssz7kwn`. Persistent state and keys remain in their established directories. Preserve the pairwise-subject key and relying-party domain. Earlier dated sections below are historical evidence, not the current deployment description.

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
