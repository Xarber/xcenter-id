# Mail deployment and address ownership

X-Center ID reserves a lowercase username at signup. Provisioning a usable address is a routing decision, independent of the username reservation. The service protects support, xarber, schoolmanager, customary operations addresses and known project names from registration. The additional reservation list must contain existing mailbox and alias names before root-domain allocation.

## Components

- `smtp-inbound.mjs` is an SMTP receiver with STARTTLS, restricted recipient resolution, size and concurrency controls, and no relay command. It routes registered mailbox names and previously created aliases. `mail-store.mjs` stores encrypted messages and keeps inbox reads scoped to the current account.
- Managed receiving domains are explicitly configured. `mail.xcenter.it` may receive ordinary mail and `hme.xcenter.it` resolves to per-account, per-app random aliases. Aliases deliver to the owning X-Center ID inbox. The app never receives the underlying address. The owner can download messages as email attachments. Internet routing must be verified before enabling these choices on the account origin.
- `email-verification.mjs` delivers one-time ownership links through an authenticated TLS SMTP submission service. An authenticated account must redeem its own unexpired link, and the address is unique. This mechanism verifies an email address and is separate from login. Runtime settings accept an authorized sender at mail.xcenter.it, xcenter.it, or management.xcenter.it. Do not use support@xcenter.it, xarber@xcenter.it or schoolmanager@xcenter.it. Outgoing mailbox composition is pending.
- Store the SMTP certificate and verification transport configuration under the appliance secrets directory with access restricted to the owning service. Do not expose credentials in, or copy existing project secrets into, release artifacts. Restore mail encryption keys along with the account and mailbox databases.

## Observed routing on 16 November 2026

The apex xcenter.it MX records point to iCloud. The mail, hme and management subdomains were CNAMEs to the existing X-Center address and did not publish separate MX records. A public TCP connection to mail.xcenter.it port 25 was refused before deployment. The root MX must keep serving existing mail until the complete recipient inventory and a tested coexistence or migration plan are approved.

For subdomains, reserve suitable DNS-only MX targets, establish TCP 25 reachability from outside the LAN and verify recipient delivery with an external sender. For outbound internet delivery, use a verified SMTP submission service with SPF, DKIM and DMARC for the selected sender. If hosting direct outbound SMTP, confirm ISP permission, reverse DNS, reputation, queues, and retry and bounce handling. Keep the root mail routes intact while validating a subdomain.
