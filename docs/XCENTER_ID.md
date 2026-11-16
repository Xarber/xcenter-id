# X-Center ID

The [live account site](https://xcenter-main-server-acer.tail91c405.ts.net:8443/) serves revision `b528298` on the private tailnet. Expo Web and the passkey API share the same HTTPS origin. The new container uses loopback port 18790 and shared ext4 account storage at `/srv/xcenter/data/xcenter-id`. The static predecessor remains on loopback port 18788. To roll back the route, use `tailscale serve --bg --https=8443 http://127.0.0.1:18788` and preserve the account database. Keep the hostname stable for WebAuthn.

Chromium with virtual authenticators verified account creation, adding a second named key, sign-out, sign-in using the second key, removal of the first key, and rejection of an unverified email. Testing used isolated temporary storage at port 8444. The staging route was disabled. The live endpoint returned the intended revision and the signed-out account response. The initial cutover briefly returned 502 during container startup, then recovered. No test account was created in live storage.

Email verification delivery is pending, so settings save no addresses. OAuth issuance, encrypted shared-data integration, native build and device verification, and backup restore remain open. Native Account, Security, Connected apps and Data access tabs are in source. Native sign-in opens the HTTPS account site.
