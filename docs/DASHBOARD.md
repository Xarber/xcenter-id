# Expo account dashboard

The first local implementation under `apps/dashboard` targets iOS, Android and web. `index.ts` registers the root, `src/App.tsx` presents account screens and `src/sample.ts` contains deterministic fictional records. The old Node application and its dependencies are independent of this package.

Run setup and checks from `apps/dashboard`.

```sh
npm ci
npm run typecheck
npm test
npx expo install --check
npm audit
npm start
```

The dashboard provides a skippable, replayable introduction and an explicit sample mode. The overview opens security credentials, connected apps, data access and sessions. The user can confirm sample grant revocation and sample sign-out for another device. Changes are held in memory and reset on leaving sample mode. Only the introduction preference persists. The app never reads legacy account files or sends mutations to a service. Dark mode, flexible layout, labeled controls and reduced-motion-aware entry transitions are implemented and need runtime verification.

Account enrollment and sign-in, live account reads, app disconnect, export/deletion and production revocation depend on the new identity and consent service. The web export now includes a root landing page and a PWA shell. See the [plan](AUTHNJS_REDEVELOPMENT_PLAN.md) and [queue](ACTIVE_TASKS.md).

## Verification on 16 November 2026

- Node 24 with Expo SDK 58. TypeScript, the sample fixture test, Expo dependency alignment and resolved public Expo configuration passed.
- The local Expo web export succeeded. Headless desktop Chrome at 390×844 and 1366×900 exercised onboarding persistence, navigation, grant cancellation and revocation, sample device sign-out, sample exit, dark appearance and reduced-motion preference. No page exceptions occurred. These viewport checks do not establish mobile-browser or native behavior.
- The dependency audit reports three moderate findings through Expo, its fingerprint package and minimatch. The installed dependency tree has no reported high or critical findings. Review the remaining advisory before promoting the dashboard. The SDK 55 install initially reported two high findings and an Expo CLI internal module error. SDK 58 resolved the alignment checks and web export.
- The manifest validator passed for the 16 initial declarations after installing jsonschema in an isolated temporary environment. The GitHub workflow has not run. Native builds, physical security keys, assistive technology testing and hosted account actions remain unverified.

[Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/)

## Redesigned web entry

Run `npm run export:web` from the dashboard to produce `dist/`. Serve it over HTTPS at the origin root. The export includes an install manifest, editable shield icon, raster icons and a content-versioned service worker. The worker caches the exported public shell and static assets only. Keep authenticated API and account HTML outside the cached paths.

Desktop Chrome smoke tests at phone and desktop widths verified the root landing page, first entry, returning via the header, browser reload, the sample dashboard, manifest loading, service-worker control and offline reload. Physical PWA installation, update prompts and native runtime remain unverified. The original site is preserved in `HTML/`.
