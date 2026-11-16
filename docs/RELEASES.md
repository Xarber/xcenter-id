# Native preview artifacts

The preview workflow runs four isolated jobs for the same source commit. Use the workflow dispatch when it is available or the dedicated `native-preview/` branch for an authorized one-off preview build. This branch mechanism keeps full builds off `testing` and does not publish a GitHub Release.

- iOS device builds produce an unsigned IPA that requires signing before installation.
- iOS simulator builds produce a zipped simulator app.
- Android builds require the four `AUTHNJS_ANDROID_*` release signing secrets referenced by the workflow. Each Android job checks configuration before downloading dependencies. Keep the existing signing identity when one has been established.
- GitHub Actions retains successful job artifacts with SHA-256 checksums. A preview build does not establish release readiness or physical-device verification.
