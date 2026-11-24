# Files, accounts and sign-in verification

X-Center ID 0.15.0 was deployed to production from `ddee0106834dc3ecc6b8360f6166a9932489e5e9`. The same revision is building in the [four-format native preview](https://github.com/Xarber/xcenter-id/actions/runs/45338367140). This is a preview build. Stable native publication and distribution synchronization remain separate release stages.

## Verified

- Forty-two API tests and fifteen dashboard tests passed. TypeScript, Expo dependency alignment, dashboard audit, release-history generation, web export and the UADS manifest validator passed.
- The file transfer regression reserves quota for concurrent uploads, rejects over-quota and foreign-account operations, cancels a reservation, retries identical chunks, moves without changing bytes, and downloads a file larger than 2 MB. The portal retains the legacy encrypted file format for existing records.
- A 390 px Chromium session exercised simultaneous progress rows, cancellation of one upload, local file drop, dragging an existing file to a folder, the Move picker, byte-for-byte filename download, and viewport overflow.
- Separate Chromium checks covered root sign-in, post-sign-in onboarding, acknowledgment after dismissal, archive navigation, gated developer commit notes, offline archived notes and eight genuine desktop and mobile dashboard captures. All captures matched the final export.
- Staged Chromium at 320 px displayed and filled six distinct device-code inputs, advanced focus and accepted a full code. The issuer regression retained its explicit confirmation step.
- Synthetic account tests verify browser session selection, denial of another browser's slot, self-deletion with recent authentication, exact username confirmation and survival of the other account.
- The Velunivo Consent Test has both requested collections saved in production. Its public start redirects to X-Center ID with PKCE and the registered callback. The callback rejects a request without a matching flow. No personal Velunivo records were read.

## Remaining evidence

Live consent approval and callback completion require the account holder. Native installation and capture remain pending for the sign-in animation, code fields, Settings pickers, transfer progress, account switcher, and deletion. Native document selection uses the system file picker and the Move picker. Web supports drag-and-drop. Spark-specific reconnection and display of server-supplied identity still require testing in Spark.

Relevant UADS areas include UI, platform, data integrity, security, quality, deployment and release validation. No full project compliance claim is made.
