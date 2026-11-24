# Sign-in and dashboard follow-up verification

X-Center ID 0.15.1 is live from `2c931ed30a4ad4ff3f80f2e5d438d57a317f2a43`. The [four-format native preview](https://github.com/Xarber/xcenter-id/actions/runs/45342155437) was submitted from that revision. The prior [0.15.0 preview](https://github.com/Xarber/xcenter-id/actions/runs/45338367140) completed successfully.

- Forty-three API tests and fifteen dashboard tests passed. TypeScript, Expo dependency alignment, audit, release-note generation and UADS manifest validation passed.
- Desktop and phone Chromium verified animation presentation, reduced motion, the fixed backdrop, the account switcher bounds, the hidden Developer Mode toggle, separate Developer Options, grouped permission switches and empty layout, and changelog Back placement. Eight screenshot captures matched the web export.
- A browser test of the isolated Files service confirmed that dismissing removal keeps the folder and accepting removes the folder and contents. The API verifies recursive deletion is owner-scoped and cleans up unfinished transfers.
- The account regression verified explicit add intent for passkey and signup options and completed an email-code addition. The old account became a parked browser session. An unrelated browser session could not redeem the code.
- The issuer browser test exercised `eI3YUO` and `a01239` at 320 px. The form accepted the characters and advanced focus. Issued-code validation remains with the provider.
- Synthetic Administration verified icon and name alignment at 390 px and 1280 px.
- Production served the expected revision, health routes, six device-code inputs, updated screenshots and the existing Velunivo consent-test endpoint.

The source tests cover native input normalization and TypeScript checks. Installed-device verification, real passkey addition on the user’s account, and completion of the live Velunivo consent exchange remain open.
