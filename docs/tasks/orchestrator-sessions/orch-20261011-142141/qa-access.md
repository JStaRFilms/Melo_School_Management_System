# QA access update

Owner supplied an existing private .env.e2e.local path. The file exists, is regular/non-symlink and contains required Convex/operator/identity fields. Only key presence was displayed; all secret values remained machine-only. The profile was not copied, edited or committed.

The exported QA doctor was invoked with the explicit profile and Admin/Teacher/Portal. It failed at scripts/qa/core.mjs:194: Node execFileSync('pnpm') could not launch the Windows shim. Its generic error says to install pnpm, but shell pnpm --version returns 10.33.2. This is a runner invocation blocker, not proof of missing pnpm or invalid credentials.

The CLI argv/pathname direct-entry comparison also no-ops on Windows. Only the exported main invocation was counted as an attempt.

No backend attestation, QA server, browser journey, synthetic write, deployment or email ran. Backend identity/origins/source/fixtures remain unverified. A bounded Windows QA tooling correction or the original QA agent is needed before continuing; task16 awaits the owner's decision. App PRs are untouched.

PR1 Draft105 is published, base master, head2803bef. PR2/PR3 stay local under the sequential plan. Private profile values/path are not part of the public PR body.
