# Repository publication review

GitHub still reports the repository as private. The five rewritten remote branch tips match the validated candidate. The default branch name and Actions workflow configuration were preserved. No new build was dispatched.

## Review and cleanup

- The original history included legacy account records, session material, encryption keys, logs and recovery exports. A limited structural review confirmed these files existed without printing their contents.
- The private recovery bundle was verified before rewriting. A separate private archive preserves the removed files for recovery. The previous Git objects are still present in local backup material and must not be pushed.
- The rewrite removed the legacy private tree, root runtime configuration, root service log and a legacy attachment archive. Every remaining file at each of the five original branch tips matched the rewritten equivalent byte for byte. The rewritten history retains 77 commits and no reachable occurrence of those paths. The local development branches now track the new history.
- The review screened 3,001 blobs outside the excluded paths for credential and personal-email patterns. It also examined all 18 retained workflow artifact archives, including nested mobile packages, and available log archives for all 10 workflow runs. No scanned credential patterns or private account files matched in the retained artifacts and logs. These checks do not establish that unrecognized sensitive content is absent.
- The native workflow was temporarily disabled for the atomic, lease-protected branch update, then re-enabled and verified active. The deployed website still returns its existing revision.

## Publication gate

An authenticated GitHub API request still retrieved an excluded historical file by its old commit ID after the rewrite. A targeted follow-up also returned HTTP 200 for a legacy user account record, an encryption key and a recovery export. The requests suppressed the response contents. There are no recorded pull requests or forks. GitHub's documented server-side purge process is required because disabling credentials cannot remove historical personal records. Keep publication blocked until GitHub confirms the purge and checks for the old file and commit no longer succeed. Then verify anonymous access to the cleaned branch and dispatch the four-format native preview from `testing`. [GitHub sensitive-data cleanup documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
