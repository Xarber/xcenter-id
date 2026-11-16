# X-Center ID

The [live account site](https://xcenter-main-server-acer.tail91c405.ts.net:8443/) serves revision  on the private tailnet. Expo Web and the passkey API share the same HTTPS origin. The new container uses loopback port 18790 and shared ext4 account storage at . The original static service remains on loopback port 18788. To roll back the route, use Available within your tailnet:

https://xarbers-macbook-air-m4.tail91c405.ts.net:8443/
|-- proxy http://127.0.0.1:18788

Serve started and running in the background.
To disable the proxy, run: tailscale serve --https=8443 off and preserve the account database. Keep the hostname stable for WebAuthn.

Chromium with virtual authenticators verified account creation, adding a second named key, sign-out, sign-in using the second key, removal of the first key, and rejection of an unverified email. Testing used isolated temporary storage at port 8444. The staging route was disabled. The live endpoint returned the intended revision and the signed-out account response. The initial cutover briefly returned 502 during container startup, then recovered. No test account was created in live storage.

Email verification delivery is pending, so settings save no addresses. OAuth issuance, the encrypted shared-data integration, native build and device verification, and backup restore remain open. Native Account, Security, Connected apps and Data access tabs are in source. Native sign-in opens the HTTPS account site.
