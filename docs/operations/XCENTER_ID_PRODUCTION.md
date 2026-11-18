# X-Center ID public deployment

The live issuer is https://id.xcenter.it. Nginx terminates TLS using the appliance's existing wildcard certificate and routes this host to revision bd6b402 on loopback 18796. Rollback uses container `xcenter-id-public-rollback-4637889` and the two `*.before-bd6b402.conf` copies under `/srv/xcenter/infra/changes/`. Start the rollback container and verify its local health before restoring Nginx routing. The versioned exports live in `/srv/xcenter/apps/xcenter-id/releases/`. Persistent SQLite databases live in `/srv/xcenter/data/xcenter-id-public`. Signing, storage, cookie and pairwise-subject keys stay under the protected public identity secret directory. Preserve the subject key across upgrades. Protect the stable relying-party domain.

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
