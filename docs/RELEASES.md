# Native preview artifacts

The preview workflow runs four isolated jobs for the same source commit. Use the workflow dispatch when it is available or the dedicated `native-preview/` branch for an authorized one-off preview build. This branch mechanism keeps full builds off `testing` and does not publish a GitHub Release.

- iOS device builds produce an unsigned IPA that requires signing before installation.
- iOS simulator builds produce a zipped simulator app.
- Android builds require the four `AUTHNJS_ANDROID_*` release signing secrets referenced by the workflow. Each Android job checks configuration before downloading dependencies. Keep the existing signing identity when one has been established.
- GitHub Actions retains successful job artifacts with SHA-256 checksums. A preview build does not establish release readiness or physical-device verification.

## AltStore Classic

`scripts/generate-altsource.py` accepts the intended device IPA and its verified release receipt. The generator checks the checksum, device platform, bundle identity, version and build and derives size, minimum OS and privacy usage from the IPA. The receipt supplies commit, stable or beta channel, date, release notes, permanent HTTPS IPA URL and the verified entitlement list including extensions. A synthetic fixture passed and wrong checksums, versions and incomplete states were refused. A live source still requires an authorized permanent IPA URL and install verification. [AltStore source specification](https://faq.altstore.io/developers/make-a-source)

On 17 November the release secret inventory was empty. The local debug keystore is unrelated to update signing. The user selected the existing release key, so supplying it through an approved private route is the next Android signing step.

After checking the project, appliance signing directory inventory, local files and GitHub history, no matching release signing identity or signed distribution was found. The user authorized creating one. A dedicated PKCS#12 key was generated and verified locally with SHA-256 certificate fingerprint `85:B2:68:3B:00:6B:D9:6B:62:9C:B6:2B:9C:21:10:65:3E:3C:0F:DE:E5:E5:B7:28:2A:1D:E5:E3:52:D4:FF:44`. Protected files are outside the checkout and GitHub lists all four release signing secrets. Preserve these credentials for future updates. No build using this key has started.

The workflow checks that the configured keystore and each Android output match that fingerprint. It reads the APK signer using APK Signer and verifies the AAB with strict JAR verification and the configured alias. Workflow YAML and shell syntax passed. An isolated signed JAR confirmed the certificate extraction and strict verification. The full APK/AAB validation still requires a build run.

Run 44138528022 for `207627d` published private workflow artifacts for the unsigned device IPA, iOS Simulator and signed Android AAB. The universal APK completed Gradle assembly, then failed the final certificate comparison, so the workflow published no APK. The workflow now explicitly signs the assembled APK with the configured release key before independently checking the signer and architectures. A fresh run must confirm the change. This preview did not publish an app release or distribution metadata.


18 November preview preparation: run 44245479618 succeeded for iOS device, iOS Simulator and Android AAB. The APK certificate matched the expected identity, but the parser rejected its `V3.0 Signer` output. The source parser now matches the certificate-digest field independent of signer-prefix variants and retains the independent expected fingerprint. A later build result is required before claiming APK success. New navigation and hosted-data work needs a fresh preview; existing artifacts do not contain it. `config/release-metadata.json` records the unchanged private preview scope. No beta/main promotion or public release is authorized by this batch.

## Version history and onboarding

[CHANGELOG.md](../CHANGELOG.md) includes the original AuthNJS 1.0.0 milestone and X-Center ID 0.1.0 through 0.16.0. There were no published GitHub releases when these records were reconstructed. Older dates identify source milestones. The 0.15.0 development entry records transfers, account switching and the updated sign-in flow. Preview builds and production revisions have separate receipts.

The structured source is `apps/dashboard/src/release-history.json`. Overview cards show up to three icon-led changes. Every version has a public web route at `/changelog/<version>` and a native deep link at `authnjs-dashboard://changelog/<version>`. The Settings archive works offline from the installed app or cached web shell. Tap the version three times in Settings to reveal and enable Developer Mode to open source commit notes from a full changelog page. GitHub's public commit history remains available.

Run `node scripts/generate-changelog.mjs` with complete Git history. It validates the ancestry of the recorded source ranges and updates the public Markdown and technical notes. Run with `--check` to check for drift. For future published releases, anchor the range to the previous published ancestor on the relevant channel. Use Conventional Commit types and scope to curate plain-language notes. Record the release channel, installed version, native build numbers, artifact commit and deployment revision separately. Use distribution manifests only for actual published releases and verified artifacts.

The first visit opens sign-in. On web and native, onboarding first appears after sign-in with a completed profile. Settings can replay it. Completing or skipping acknowledges the current version. Returning users see a compact update panel once per user-visible version after the account is ready. Closing it or opening its full notes saves acknowledgment. Older installations retain the existing tour and release preference keys.

Web onboarding captures are tracked under `apps/dashboard/public/assets/onboarding`. To refresh and test portrait mobile and desktop web against an isolated synthetic account, export the web app and run `python3 apps/dashboard/scripts/capture-release-web.py <export-dir> <output-dir>` with Playwright and Chromium installed. The script serves the export on loopback, records the source revision, version, capture date and viewport, and checks tour navigation, release acknowledgment, old version links, Developer Mode gating and offline archive navigation. Developer Options exposes a screenshot preview and download for those captures. Native iPhone, iPad, Android phone and tablet captures are pending runtime access. Those tours use platform icons until genuine device-class captures are available.

## 26 November 0.18.0 preview and deployment

The [native preview run](https://github.com/Xarber/xcenter-id/actions/runs/45808671453) was submitted from `testing` at `82db70d` for iOS unsigned IPA, iOS Simulator, Android signed universal APK, and Android signed AAB. The subsequent deployment change fixes a server-only Administration search issue. Production serves `be221b0` with the same web and native client source. See the [deployment receipt](operations/XCENTER_ID_PRODUCTION.md#26-november-dashboard-0180-rollout). The preview workflow produces CI artifacts. Publication and physical-device verification are separate.

SDK source `73ac2ce` is on the SDK repository's `testing`, `beta`, and `main` branches. The [quality matrix](https://github.com/Xarber/xcenter-id-sdk/actions/runs/45807687102) passed for the functional source `b595357`. The follow-up commit adds two tests only, and all 14 SDK tests passed locally with Chrome enabled. The npm package versions in source are 0.4.0 for client, server, and web and 0.6.0 for Expo.

## 26 November 0.19.0 app container files

The [native preview](https://github.com/Xarber/xcenter-id/actions/runs/45822837633) was dispatched from `testing` at `f376cfb` for iOS device, iOS Simulator, signed Android APK and signed Android AAB. Two subsequent server-only commits authenticated stored file visibility and added a regression. The web/API rollout at `2a8f51d` uses the same dashboard source. See [production and rollback verification](operations/XCENTER_ID_PRODUCTION.md#26-november-dashboard-0190-rollout). This preview does not publish native releases.

Chrome against isolated fixtures verified the Files changes and captured representative web views at 390 px and 1,280 px. Installed iOS and Android behavior and native screenshots remain unverified. The prior 0.18.0 [preview run 45808671453](https://github.com/Xarber/xcenter-id/actions/runs/45808671453) completed successfully.

## 26 November 0.20.0 peer update

The [provider quality run](https://github.com/Xarber/xcenter-id/actions/runs/45838931269) passed at `c5beb38`. A [native preview](https://github.com/Xarber/xcenter-id/actions/runs/45838931627) was started for the same commit. A native release and physical-device verification remain open. Isolated browser checks verified record ordering and repeated Developer Apps navigation at 390 px and 1,280 px.

The [SDK quality matrix](https://github.com/Xarber/xcenter-id-sdk/actions/runs/45838776124) passed web, Swift, Android/JVM and Flutter/Dart at `7371295`. The browser peer tests used real Chromium WebRTC connections with fixtures for media and signaling. They exercised audio/video tracks, screen-track substitution, file transfer and independent parallel connections. Real capture selection, installed device checks and cross-network TURN are separate.

## 26 November 0.21.0 file metadata update

Web and API revision `6be04fe` are live. The release includes file digests, one-file metadata and editable app files. Public SDK source revision `19da834` is on testing, beta and main. See [production verification and recovery](operations/XCENTER_ID_PRODUCTION.md#26-november-file-metadata-rollout) and the [content hash contract](APP_CONTAINER_FILES.md#file-metadata-and-content-hashes).
