# Native dashboard and public SDK verification

## Dashboard 0.13.0

The preview source is `fdde5ca` on `testing`. It includes `48d0420`, which brought the mobile web profile hero, colored shortcut tiles, borders and dividers to native. Administration displays separate cards for accounts, username requests, support, storage, developer verification and registered apps. Account detail and app storage retain dedicated navigation. The implementation reused the existing authenticated account APIs.

- Dashboard TypeScript, all 11 automated checks and the UADS declaration check passed.
- Expo Metro produced Hermes bundles for iOS and Android. This checked bundling only.
- GitHub refused the [first native preview attempt](https://github.com/Xarber/xcenter-id/actions/runs/44716961210) before job setup. Its annotation cited billing or a spending limit. Later anonymous verification confirmed the dashboard repository was public. The [new four-format preview](https://github.com/Xarber/xcenter-id/actions/runs/44717530734) uses the same source commit.
- Installed phone layout, text scaling, themes and live administrator workflows remain to verify. The preview does not publish a release or deploy the website.

## SDK

The [standalone repository](https://github.com/Xarber/xcenter-id-sdk) is publicly readable. It started with reviewed SDK source, synthetic tests and public branding. Local checks covered the account card at a 360-pixel Chrome viewport, signed-out and signed-in states, the account details and a settings toggle, HTTPS callback rules, live issuer discovery, Swift source parsing and manifest validation. Both installed and repository copies of the integration skill passed validation. [SDK platform checks](https://github.com/Xarber/xcenter-id-sdk/actions/runs/44717312017) track compilation and widget tests for the current SDK. Actual relying-party browser return and product-session redemption need a registered test app on each supported platform.
