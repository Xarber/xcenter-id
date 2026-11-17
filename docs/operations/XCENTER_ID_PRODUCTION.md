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
