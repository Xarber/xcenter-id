# Developer sandbox

The sandbox runs the X-Center ID account dashboard and OpenID Connect issuer in a separate process. Use a test passkey account and a test registration. Clients use the sandbox discovery document and issuer, and exchange codes there. Production IDs, access tokens, signing keys, sessions, mail and databases stay on the production issuer. Sandbox registrations receive IDs beginning with `xid-test-`.

For a standard registration, use a callback on a domain you control and complete the same callback verification as in production. An exact loopback callback can use the existing local registration path. You can open the live consent flow for the test registration to review its current access requests. The app's **Test requests** panel shows recent authorization and token outcomes. It holds up to 20 timestamped outcomes per app in memory and records no tokens, codes, IP addresses, subject IDs or request payloads.

## Bootstrap and deploy

Generate the keys off the application path with `node services/api/sandbox-config.mjs <https-origin> <absolute-empty-state-dir> <absolute-secrets-file>`. The bootstrap refuses to overwrite existing material, and startup verifies that the state and issuer configuration match. The production process refuses a sandbox configuration. Configure only:

- `AUTHNJS_SANDBOX=1`
- `AUTHNJS_ACCOUNT_ORIGIN=https://id-sandbox.xcenter.it` for the appliance, or a dedicated HTTPS loopback origin for local verification.
- `AUTHNJS_OIDC_CONFIG` pointing to the generated protected file.
- `AUTHNJS_DATA_DIR` pointing to the bound sandbox state directory.
- `AUTHNJS_WEB_ROOT` if the web export is outside the default mount.

At deployment, mount only the sandbox secrets and data, route its hostname to its own loopback port, and use the appliance's existing wildcard certificate. Keep the sandbox outside the production backup set. Startup refuses mail, production fixtures, admin allowlists and storage-volume settings. Do not attach the live production databases, even as read-only. For a local bootstrap, expose TLS through a dedicated reverse proxy before attempting passkey or OAuth interactions.

Use a standard OpenID Connect client explicitly configured with the sandbox issuer. The production SDK's default issuer remains unchanged. Test issuer discovery, account and client separation, and an actual PKCE round trip before enabling a portal link. Deployment rollback removes the sandbox vhost and stops its container while preserving its isolated state.
