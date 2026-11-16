# AuthNJS repository instructions

Start with [docs/INDEX.md](docs/INDEX.md), [docs/ACTIVE_TASKS.md](docs/ACTIVE_TASKS.md) and the latest UADS supplied for the task. Read [IDEAS.txt](IDEAS.txt) as historical context. Treat those ideas as unapproved unless the user selects them.

The root Node project is the legacy baseline. Use the separate Expo package under `apps/dashboard` for replacement work. Keep historical keys, logs, account files, exports and configuration out of new tests, logs, workflows, deployment artifacts and screenshots. Use synthetic fixtures and version-matched Expo APIs.

Apply the build start gate before local and remote builds or pushes that trigger them. Record actual checks and missing runtime evidence in the queue. Preserve the existing repository and release workflow until a migration is authorized.
