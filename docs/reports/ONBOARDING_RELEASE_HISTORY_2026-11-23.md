# Onboarding and release history verification

The dashboard and API shipped to production as 0.14.0 from `fcea370037e7d4c962c921fcf1a4f07bee075a30`. Native preview [45264711602](https://github.com/Xarber/xcenter-id/actions/runs/45264711602) uses that revision. All four preview jobs were running when checked. No native release or distribution metadata was published.

## Checks

- Dashboard TypeScript, 15 dashboard tests, Expo dependency alignment, web export, changelog drift check and UADS manifest validation passed. The dashboard dependency audit reported zero vulnerabilities.
- All 40 API tests passed. The scope includes device authorization, Files and hosted data authorization.
- Chromium at 1280×800 and 390×844 exercised first visit, tour back and skip, persistence, skipped-version highlights, same-version suppression, legacy version links, direct Developer Mode gating and offline release routes. The account fixture and network were isolated on loopback.
- Eight web screenshots were captured from actual Overview, Apps, Permissions and developer documentation screens. The final export reproduced the committed image bytes. The capture manifest records device class and source revision.
- Public HTTPS returned the intended revision, new changelog routes, device sign-in and service worker. OpenID Connect discovery advertises device authorization. A signed-out account probe returned no account.
- Seven SQLite rollback snapshots passed quick checks and the previous production container remains available. The first staging attempt needed the existing read-only dependency mount point. The next probe used HTTP for the secure issuer and failed on the device route. Retrying with production HTTPS proxy headers passed. Production validation then passed with zero candidate restarts.

## Outstanding verification

- Native captures and on-device interaction checks for onboarding, sign-in, code pairing, deep links, Files and Reduced Motion require running the native build on the relevant devices. Native walkthroughs use the existing icon illustrations until genuine matched captures are available.
- Velunivo Consent Test is active. Saving the two requested collections awaits the developer passkey. Its registered callback returned HTTP 404 and end-to-end consent is pending.
- Evidence covers UADS §§16, 22, 23, 24, 37, 42 and 44 for the checks above. Stable native release, complete accessibility coverage and full screenshot maintenance remain pending.
