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
