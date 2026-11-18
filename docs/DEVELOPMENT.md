# Development entry points

Start from INDEX.md and ACTIVE_TASKS.md. The maintained API is services/api and the Expo SDK58 dashboard is apps/dashboard. Keep historical root Node data out of fixtures and exports. Run `npm test --prefix services/api`, `npm run typecheck --prefix apps/dashboard` and `npm test --prefix apps/dashboard`. The UADS validator needs the jsonschema dependency declared in CI. The build gate and private native-preview workflow are documented in RELEASES.md. Hosted data and navigation architecture are described in HOSTED_DATA.md and NAVIGATION.md.
