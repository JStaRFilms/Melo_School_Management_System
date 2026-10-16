# Validation record

## Before implementation
- Dependencies installed with `pnpm install --frozen-lockfile --ignore-scripts`, successful. Lockfile unchanged.
- Admin baseline test command unintentionally selected the entire suite because the script received a separating --. Result: 77 files and 342 tests passed. Existing act/styled-jsx warnings appeared. This is baseline evidence, not evidence for the planned fixes.
- The normal `pnpm qa:doctor --apps admin,teacher,portal` invocation returned 0 without running doctor on Windows. Its entry guard compares process.argv[1] with URL.pathname; the forms differ on Windows. No .qa state was created, so do not claim QA passed.
- Follow-up used the existing exported main function rather than changing unrelated QA code. It correctly failed because the worktree has no .env.qa.local. Browser QA remains blocked until an approved isolated profile is available.
- No browser or external-provider feature verification yet. No production/development deployment or email sends.
