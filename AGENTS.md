# X-Center ID repository instructions

Start with [docs/INDEX.md](docs/INDEX.md), [docs/ACTIVE_TASKS.md](docs/ACTIVE_TASKS.md) and the latest UADS supplied for the task. Historical ideas are documented in the [legacy review](docs/LEGACY_REVIEW.md). Treat them as unapproved unless the user selects them.

Use `apps/dashboard` for the Expo dashboard and `services/api` for the current identity and storage services. Keep historical keys, logs, account files, exports and configuration out of new tests, logs, workflows, deployment artifacts and screenshots. Use synthetic fixtures and version-matched Expo APIs.

Apply the build start gate before local and remote builds or pushes that trigger them. Record actual checks and missing runtime evidence in the queue. Preserve the existing repository and release workflow until a migration is authorized.
