# Native preview artifacts

The preview workflow runs four isolated jobs for the same source commit. Use the workflow dispatch when it is available or the dedicated `native-preview/` branch for an authorized one-off preview build. This branch mechanism keeps full builds off `testing` and does not publish a GitHub Release.

- iOS device builds produce an unsigned IPA that requires signing before installation.
- iOS simulator builds produce a zipped simulator app.
- Android builds require the four `AUTHNJS_ANDROID_*` release signing secrets referenced by the workflow. Each Android job checks configuration before downloading dependencies. Keep the existing signing identity when one has been established.
- GitHub Actions retains successful job artifacts with SHA-256 checksums. A preview build does not establish release readiness or physical-device verification.

## AltStore Classic

`scripts/generate-altsource.py` accepts the intended device IPA and its verified release receipt. The generator checks the checksum, device platform, bundle identity, version and build and derives size, minimum OS and privacy usage from the IPA. The receipt supplies commit, stable or beta channel, date, release notes, permanent HTTPS IPA URL and the verified entitlement list including extensions. A synthetic fixture passed and wrong checksums, versions and incomplete states were refused. A live source still requires an authorized permanent IPA URL and install verification. [AltStore source specification](https://faq.altstore.io/developers/make-a-source)

On 17 November the release secret inventory was empty. The local debug keystore is unrelated to update signing. The user selected the existing release key, so supplying it through an approved private route is the next Android signing step.
