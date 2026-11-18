# Mail deployment and address ownership

X-Center ID reserves a lowercase username at signup. Provisioning a usable address is a routing decision, independent of the username reservation. The service protects support, xarber, schoolmanager, customary operations addresses and known project names from registration. The additional reservation list must contain existing mailbox and alias names before root-domain allocation.

## Components

- `smtp-inbound.mjs` is an SMTP receiver with STARTTLS, restricted recipient resolution, size and concurrency controls, and no relay command. It routes registered mailbox names and previously created aliases. `mail-store.mjs` stores encrypted messages and keeps inbox reads scoped to the current account.
- Managed receiving domains are explicitly configured. `mail.xcenter.it` may receive ordinary mail and `hme.xcenter.it` resolves to per-account, per-app random aliases. Aliases deliver to the owning X-Center ID inbox. The app never receives the underlying address. The owner can download messages as email attachments. Internet routing must be verified before enabling these choices on the account origin.
- `email-verification.mjs` delivers one-time ownership links through an authenticated TLS SMTP submission service. An authenticated account must redeem its own unexpired link, and the address is unique. This mechanism verifies an email address and is separate from login. Runtime settings accept an authorized sender at mail.xcenter.it, xcenter.it, or management.xcenter.it. Do not use support@xcenter.it, xarber@xcenter.it or schoolmanager@xcenter.it. Optional mailbox composition uses a separate authenticated SMTP submission configuration and derives the sender from the signed-in user's provisioned mailbox. The appliance does not submit production mail until the provider is configured and verified.
- Store the SMTP certificate and verification transport configuration under the appliance secrets directory with access restricted to the owning service. Do not expose credentials in, or copy existing project secrets into, release artifacts. Restore mail encryption keys along with the account and mailbox databases.

## Observed routing on 16 November 2026

The apex xcenter.it MX records point to iCloud. The mail, hme and management subdomains were CNAMEs to the existing X-Center address and did not publish separate MX records. A public TCP connection to mail.xcenter.it port 25 was refused before deployment. The root MX must keep serving existing mail until the complete recipient inventory and a tested coexistence or migration plan are approved.

For subdomains, reserve suitable DNS-only MX targets, establish TCP 25 reachability from outside the LAN and verify recipient delivery with an external sender. For outbound internet delivery, use a verified SMTP submission service with SPF, DKIM and DMARC for the selected sender. If hosting direct outbound SMTP, confirm ISP permission, reverse DNS, reputation, queues, and retry and bounce handling. Keep the root mail routes intact while validating a subdomain.

## Hide My Email tiers and administration

New standard aliases use random UUIDs at `hme.xcenter.it`. Premium aliases use generated dotted local parts at `mail.xcenter.it`, separate from ordinary usernames. The production mail configuration must enable routing before sign-in can offer either tier. The administrator role is granted by stable account ID through the protected server environment variable `AUTHNJS_ADMIN_ACCOUNT_IDS`. A recent passkey sign-in is required before changing account eligibility. Revoking eligibility blocks new premium issuance and preserves existing delivery addresses. The reserved `admin@management.xcenter.it` mailbox is not provisioned by profile signup or tied to the administrator role.

A locally configured dashboard can read mail from the on-appliance inbox and submit messages to registered X-Center recipients through the existing STARTTLS SMTP listener. External inbound publication and Hide My Email require tested public ingress. External sending and verification/code delivery require an authenticated submission route. On 17 November, TCP 25 timed out from outside X-Center and outbound direct connections to Gmail and iCloud MX hosts timed out from the appliance.

## Deferred external delivery options

- A Postfix smarthost on X-Center would give the application a local submission endpoint, durable mail queues, retries and delivery logs. With outbound TCP 25 timing out, configured authenticated upstream submission on 587 or 465 is the practical route once a sender and provider are approved. [Postfix configuration](https://www.postfix.org/BASIC_CONFIGURATION_README.html) · [Postfix SASL](https://www.postfix.org/SASL_README.html)
- Direct self-hosted internet delivery requires reachable inbound TCP 25 and MX, working outbound TCP 25, appropriate PTR and forward DNS, SPF and DKIM, DMARC, a stable sending IP, queue monitoring, and verified behavior with external recipients. Installing an MTA on X-Center would not resolve the observed reachability problem. Preserve the existing apex MX.
- The work to enable external delivery is deferred. No Postfix service, public submission listener, paid relay, or DNS change is part of the compose update.

The web inbox opens a dedicated composer only after the fixed New email action is selected. Native opens a dedicated composition screen from the same action. Canceling preserves fields and the selected attachment while the Mail tab is open. A successful submission clears the draft. Native type checking passed and installed-device validation remains open.

## Reading and cleanup

Both account clients can open a message inside Mail, download individual attachment bytes or download the original RFC 822 message, and permanently delete a message after confirmation. The attachment response uses a generic filename and a forced download. Display names are treated as text. The API derives the owner from the authenticated account session and filters every lookup and deletion by that owner. Changes are visible on reload on other devices. Old snapshots may still contain previously deleted ciphertext.

On web, opening a message uses an individual `/mail/<id>` URL. A reload or a completed sign-in returns to the message. The server authorizes the message request against the signed-in account. Native opens a dedicated reader and supports returning to the same inbox.

The API parses bounded incoming MIME and returns plaintext. HTML-only messages are converted to text, without image loading or raw HTML. Native and web use the same API. The original message remains available for use in an external client. Incoming MIME support does not enable rich outbound composition, public SMTP delivery or IMAP. [MailParser documentation](https://nodemailer.com/extras/mailparser)

On 17 November the full API suite passed 16 tests, including anonymous and cross-account access denial, download headers, MIME rendering, origin checks and owner-scoped deletion. The Expo dashboard typecheck passed. Public TCP 25 still refused connections, and DNS showed no dedicated MX for the two receiving subdomains. The new reader has not been staged or physically tested.

The compose form accepts an optional small attachment (up to 256 KB) and optional bold/italic formatting. Both clients send text and base64 bytes through the existing authenticated composition API. The server builds its own HTML from escaped text and validates the attachment's size, name and canonical encoding. External transport and IMAP remain separate operational work.

Direct X-Center transport was selected on 17 November. TCP 25 accepts over the tailnet and on the appliance, and the local SMTP STARTTLS certificate validates for mail.xcenter.it. The public address matches the appliance's egress address. Public TCP 25 was refused. Outbound TCP 25 to Gmail and iCloud timed out. The Iliadbox router management UI requires sign-in. Next verify the WAN forwarding and outbound SMTP policy there, then validate reachability from an independent network before setting subdomain MX and sender authentication. The apex iCloud MX is existing infrastructure.

The approved Iliadbox rule now forwards only WAN TCP 25 to the SMTP service on the appliance. A public-hostname check from the Mac passed STARTTLS after the change. Cloudflare now has a DNS-only address for mail.xcenter.it and MX records for mail.xcenter.it and hme.xcenter.it pointing there. Both authoritative nameservers and a recursive resolver served those records. The apex MX still uses iCloud. If the WAN address changes, update the SMTP address record and recheck the forward. Full incoming delivery from an independent external mailbox remains unverified.

The dashboard and account API now list previously issued private addresses and let their owner disable standard or premium aliases. Disabled addresses stop accepting delivery and remain reserved. Alias issuance remains gated by public delivery configuration. Direct outbound to Gmail and iCloud was still unreachable, including the IPv6 check. The router's visible Internet settings exposed no SMTP-specific egress option. Public submission, external code delivery and IMAP remain open.

The SMTP container was upgraded to the receiver sources from `94ccae4`. A synthetic fixture received a message in isolated storage using the production certificate. Production passed public-hostname STARTTLS and accepted a recipient at mail.xcenter.it while rejecting an external relay recipient. The previous container `xcenter-id-smtp` is stopped and retained. Rollback stops only `xcenter-id-smtp-94ccae4` and starts the previous receiver, then rechecks port 25 and TLS.

Both clients offer **Load older email** after the first 100 messages. `GET /account/inbox` returns `messages` and an opaque `nextCursor` or null. Send that cursor as the `cursor` query parameter to load the next page. The server sorts by receipt time and message ID while applying the owner constraint on every page. Deleting the message at the page boundary does not invalidate the cursor.

Both clients offer **Select messages** in the inbox and require confirmation before permanent deletion. `DELETE /account/inbox` accepts up to 100 message IDs, checks the authenticated owner and mutation intent, and returns the number deleted. It applies the whole batch in a single transaction. Requests can be retried safely. Chrome on an isolated issuer verified that cancellation preserved all messages and confirmed deletion removed only the selected messages after reload.

At a 390 px Chrome viewport, the isolated HTTPS issuer passed username-first signup with a virtual passkey, loading the 101st message, reading its stored MIME, and confirming that deletion persisted after reloading. API coverage exercised tied timestamps, deleting the page boundary, owner isolation, and cursor validation. The installed native client and public delivery remain to verify.

## Temporary inbound verification

When the protected mail configuration sets `inboundVerification` to true, Profile can prepare an email to `verify@mail.xcenter.it`. The user chooses the address to verify and sends the descriptive mailto draft from that mailbox. The draft contains a random 256-bit single-use code in its subject and body. Codes expire after 20 minutes. The browser and native screens check the authenticated verification state without storing the code in persistent client storage.

The SMTP receiver treats this destination as a verification service. It parses a bounded message, requires one From mailbox matching the pending address, and recomputes authentication from the raw message and SMTP peer using mailauth 8.1.0. It requires DMARC pass and an exact-domain RSA-SHA256 or Ed25519-SHA256 DKIM signature covering From, subject and the entire body. RSA keys must have at least 2048 bits. Supplied Authentication-Results and Received headers cannot confer verification. The account must be unrestricted at the final database transaction. The verified-address assignment and code consumption commit together. The old outbound-link verification remains available when sending is configured.

This conservative flow may reject legitimate messages with forwarding changes, partial-body signatures, signing subdomains or missing authentication. It relies on the sender's provider to enforce mailbox ownership within its authenticated domain. It does not replace the queued work for outbound delivery or external SMTP submission and mailbox access. The integration test used a generated RSA key and fixture DNS to verify a signed message delivered through the actual SMTP receiver. Replays, expired codes, unsigned messages and forged authentication headers were rejected. First receipt from an independent external mailbox remains to verify.

The receiver logs only a bounded error code, timestamp and listener/connection class. Sender addresses and raw error messages are excluded. Connection errors do not automatically mark the listening process as failed; bind/permission errors do.
