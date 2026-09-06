# U7 Access and Tooling Preflight

**Scope:** U7 preflight only. No login, Convex command, seed, migration, import/export, deployment, synchronization, application server, provider action, trace, screenshot, or credential use was performed.

**References reviewed:** `U7a-acceptance.task.md`, D-05 target-proof procedure, `REALISTIC_SCHOOL_SETUP_TEST_BOOK.md`, root/app package scripts, root Playwright configuration, Convex setup scripts/verifier, and the Sites static configuration seam.

## Result summary

**Overall: BLOCKED before authenticated or server-backed acceptance.** The required external development-target allowlist is missing, and the current shell has no `CONVEX_DEPLOYMENT`. Named target values were read only in process memory and were never printed, copied, hashed, or recorded. No named value showed the D-05 `prod:`/`production:` stop marker, but that is not sufficient proof of an approved development target.

| Target | Result | Value-safe finding |
|---|---|---|
| Root `.env.local` | **MISSING approval proof** | Required deployment and URL keys are present and syntactically inspectable, but the deployment/URL pair cannot be matched because the external allowlist is absent. |
| Active shell | **MISSING** | `CONVEX_DEPLOYMENT` is not set. |
| Admin | **MISSING approval proof** | Named client URL exists and is internally consistent with the root URL; no external approval match is possible. |
| Apply | **MISSING app / approval proof** | Named client URL exists and is internally consistent with root, but `apps/apply/package.json` and an Apply app directory are absent. No Apply runtime can be accepted. |
| Platform | **MISSING approval proof** | Named client URL exists and is internally consistent with root; no external approval match is possible. |
| Portal | **MISSING approval proof** | Named client URL exists and is internally consistent with root; no external approval match is possible. |
| Teacher | **MISSING approval proof** | Named client URL exists and is internally consistent with root; no external approval match is possible. |
| Public web (`www`) | **MISSING approval proof** | Both named server/public URLs exist and are internally consistent with root; no external approval match is possible. |
| School Sites | **PASS — static seam** | No `apps/sites/.env.local` exists, no Convex reference was found under `apps/sites`, and `apps/sites/lib/site.ts` explicitly identifies its inputs as statically published and not synchronized from private Admin data. |

No configuration was changed. Internal consistency is not an environment authorization result.

## Browser/tool availability

- `@playwright/test`: **PASS — installed and loadable**.
- Chromium: **PASS — actual headless launch completed**.
- Safe browser proof: a fresh context opened `about:blank` and closed normally.
- No app URL, network target, credentials, storage state, trace, screenshot, or video was used.
- Root `playwright.config.js` is **not safe to run unchanged for U7 acceptance**: it loads `e2e/global-setup.js` (documented by U7a as invoking a Convex seed), starts Admin/Teacher/Portal servers, and retains traces/videos on failure.

## Credentials preflight

`tmp/demo_school_credentials.md` is **present**. Only heading presence was checked; no identifiers, passwords, or body content were recorded.

Persona/category headings present:

- School administration
- Teaching faculty
- Parent/student portal
- Multi-campus reference

No login was attempted.

## Port and process preflight

The listening state and owning process command-line classification were inspected without recording raw command lines.

| Port | Intended app | State |
|---:|---|---|
| 3000 | Public web | Free |
| 3001 | Teacher | Free |
| 3002 | Admin | Free |
| 3003 | Portal | Free |
| 3005 | Sites | Free |
| 3006 | Platform | Free |

No existing server or unrelated cache/process was stopped or modified.

## Safe bind commands and URLs (not run)

These commands start development servers and therefore remain gated on successful allowlist proof. Existing Admin/Teacher/Portal/Platform/www development scripts already bind to `0.0.0.0`. Sites needs an explicit host override.

| App | Command | Local URL | Tailscale URL |
|---|---|---|---|
| Public web | `pnpm --filter @school/www dev` | `http://localhost:3000` | `http://100.84.230.66:3000` |
| Teacher | `pnpm --filter @school/teacher dev` | `http://localhost:3001` | `http://100.84.230.66:3001` |
| Admin | `pnpm --filter @school/admin dev` | `http://localhost:3002` | `http://100.84.230.66:3002` |
| Portal | `pnpm --filter @school/portal dev` | `http://localhost:3003` | `http://100.84.230.66:3003` |
| Sites | `pnpm --filter @school/sites exec next dev --webpack --port 3005 -H 0.0.0.0` | `http://localhost:3005` | `http://100.84.230.66:3005` |
| Platform | `pnpm --filter @school/platform dev` | `http://localhost:3006` | `http://100.84.230.66:3006` |

The Tailscale IPv4 address above was obtained during this preflight with `tailscale ip -4`; re-run that command before a later server session rather than assuming it is unchanged. Binding to `0.0.0.0` is not Tailscale-only and may also expose a server to the local network depending on Windows Firewall and network settings. If remote access fails, verify Tailscale connectivity, the `0.0.0.0` listener, and the firewall rule for the selected port. No Funnel, port forwarding, or public tunnel is authorized.

The root `pnpm dev` command would run all workspace development tasks, including Sites without its required remote host override. Individual commands are safer for bounded evidence sessions. Package `start` scripts do not specify `0.0.0.0` and are not recommended for this preflight path.

## Command-semantics gates

| Command/script | Semantics | Disposition |
|---|---|---|
| `pnpm test:e2e` / root Playwright config | Runs global setup that can seed Convex; can start three app servers and retain failure artifacts. | **Do not run unchanged.** |
| `pnpm dev` | Starts workspace development servers through Turbo. | **Not run; target proof required first.** |
| `convex:dev`, `convex:codegen` | Reach the selected Convex deployment; development may push functions and codegen depends on deployment selection. | **Not run.** |
| `convex:deploy` | Deploys Convex functions. | **Not run.** |
| `demo:seed`, `judge:seed` | Invoke mutating seed functions. | **Not run.** |
| `scripts/setup-convex.ps1` / `.sh` | May globally install the CLI, initialize/connect a project, run `convex dev --once`, and create environment files. | **Not run.** |
| `scripts/verify-convex-setup.ts` | Although named a verifier, it invokes Convex codegen when local checks pass. | **Not run.** |
| D-05 import/export/migration/refresh commands | Reach or mutate deployment data and require separate authorization and target proof. | **Not run.** |
| Blank-page Playwright launch | Local transient browser process with `about:blank`; no trace or persistence. | **Run; passed.** |
| Port/process inspection | Local read-only listener and sanitized command-line classification. | **Run; all intended ports free.** |
| `tailscale ip -4` | Prints only the machine's current Tailscale IPv4 address. | **Run; succeeded.** |

## Exact blockers

1. `$HOME/.melo-ops/approved-development-targets.json` is absent, so no root or app Convex target can be proven to be the approved **DEVELOPMENT** deployment.
2. The active shell lacks `CONVEX_DEPLOYMENT`, so it cannot exactly match an approved development deployment.
3. The Apply runtime is absent even though an ignored/local target file is present; U7 cannot treat Apply as an available app.
4. Root Playwright execution is unsafe for this acceptance scope until a reviewed isolated no-seed/no-server/no-trace configuration is selected.

## Minimal safe next action

An authorized operator should create or restore the access-controlled external development allowlist at the D-05 path, containing only the approved development deployment ID and approved Convex URL set, then set the shell deployment in a private terminal and rerun the D-05 value-silent exact-match procedure. Do not change repository configuration, run Convex, or start servers until root, shell, Admin, Platform, Portal, Teacher, and www all pass that check. Separately decide whether Apply is intentionally retired or must be restored; do not infer a runtime from its local environment file.

After target proof passes, use a reviewed isolated Playwright configuration that omits seed/global setup, does not auto-start broad servers, disables trace/video/network-payload capture, and uses non-persistent redacted persona contexts.

## Preservation

No existing application/configuration file was modified. Unrelated work, including `deliverables/school-sponsorship-skill` and session `orch-20260905-170029`, was not changed. No Astra tooling was used.
