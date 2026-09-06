# U7a — Integrated acceptance, evidence and disk-openable report

**Status: REPORT COMPLETE / AVAILABLE EVIDENCE CAPTURED / AUTHENTICATED ACCEPTANCE BLOCKED.**

U7a report work is complete within the documented safety boundary. Ten real screenshots were captured from the existing published static Sites app. No mock, placeholder, stale screenshot or report preview is counted as implementation evidence. Authenticated Admin, Teacher, Portal, Platform and www screenshots—and real application print evidence—remain incomplete due the technical environment authorization gate.

## Authorization decision honored

`$HOME/.melo-ops/approved-development-targets.json` is absent, and the active shell has no `CONVEX_DEPLOYMENT`; therefore no approved **DEVELOPMENT** Convex target or account can be proven under D-05. This is the exact blocker recorded for every unavailable screenshot group in both evidence manifests.

Accordingly:

- Admin, Teacher, Portal, Platform and www were not started or authenticated.
- The credential file body was not read.
- No Convex command, seed, deployment, migration, provider, payment, production, external synchronization or Astra operation ran.
- Root `playwright.config.js` was not used because its global setup invokes Convex seed and starts broad app servers.
- No trace, authenticated storage state or video was captured.
- The absent Apply runtime was not represented by a substitute screen.

The completed final code acceptance remains **APPROVE** for the reviewed source. This U7 result does not upgrade that code verdict into deployed, provider, production or authenticated-browser readiness.

## Static Sites session

Sites was the only app authorized to start because its checked source/configuration has no Convex target and explicitly uses a statically published data seam.

- Exact start command: `pnpm --filter @school/sites exec next dev --webpack --port 3005 -H 0.0.0.0`
- Actual listener confirmed: `0.0.0.0:3005` (process listener inspection)
- Local listener: `http://localhost:3005`
- Active local hostname used for evidence: `http://greenfield.schoolos.localhost:3005`
- Tailscale IPv4 captured at runtime with `tailscale ip -4`: `100.84.230.66`
- Tailscale listener URL: `http://100.84.230.66:3005`

The raw local preview hostname returns the app's configured canonical redirect without port; the explicit `greenfield.schoolos.localhost:3005` URL was used for successful local evidence. The raw Tailscale IP reaches the listener but receives the real unknown-host 404 because Sites is hostname-routed. A remote client would need a local DNS/hosts mapping from the published hostname to the current Tailscale IP. Binding to `0.0.0.0` is not Tailscale-only and may also expose port 3005 on the LAN depending on Windows Firewall and network settings. No Funnel, router forwarding or public tunnel was used.

Only the owned Sites process/listener was stopped after capture and report verification. No unrelated server or cache was stopped or deleted.

## Real implementation screenshots

All files are under `deliverables/melo-expansion-productization-assets/screenshots/` and carry SHA-256/timestamp/viewport/final-URL metadata in the JSON manifest.

| ID | State | Result |
|---|---|---|
| `sites-greenfield-home-desktop` | Published home, 1440×1000 full page | HTTP 200, captured |
| `sites-greenfield-contact-desktop` | Published contact, desktop | HTTP 200, captured |
| `sites-greenfield-home-mobile-320` | Published home, 320px full page | HTTP 200, captured |
| `sites-greenfield-admissions-mobile-390` | Published admissions, 390px | HTTP 200, captured |
| `sites-greenfield-keyboard-focus-desktop` | Three Tab presses; focus reached About link | HTTP 200, captured |
| `sites-greenfield-zoom-200-desktop` | Chromium CDP `pageScaleFactor=2` | HTTP 200, captured |
| `sites-aster-home-desktop` | Second published school/theme/template | HTTP 200, captured |
| `sites-known-host-missing-route-error-desktop` | Active host, unpublished path | HTTP 404, captured |
| `sites-unknown-host-error-mobile` | Unknown host, 320px | HTTP 404, captured |
| `sites-inactive-host-error-desktop` | Published inactive host | HTTP 404, captured |

The three error captures are real responses. In this development runtime their body was visually blank rather than showing the authored custom not-found card. That observed defect is recorded with the screenshots and HTTP status instead of being replaced by a fabricated error mock.

The application CSS references Google Fonts. Capture contexts blocked Google font requests and rendered system fallbacks; no external CDN asset was added to the report or evidence bundle.

## Deliverables

- `deliverables/melo-expansion-productization-report.html`
- `deliverables/melo-expansion-productization-assets/data/evidence-manifest.json`
- `deliverables/melo-expansion-productization-assets/data/evidence-manifest.md`
- `deliverables/melo-expansion-productization-assets/screenshots/*.png` — ten implementation evidence files
- `deliverables/melo-expansion-productization-assets/report-previews/*.png` — desktop/mobile report artifacts, explicitly not implementation evidence
- this result
- updated `ui-coverage-matrix.md`

The report contains inline CSS and JavaScript only, uses relative artifact/screenshot links, provides a responsive U1–U7 dashboard, 25 workflow records with purpose/previous/new/persona/app/route/permission/tests/limitations, real screenshot gallery, draft PR/commit ledger, exact full checks, issues/gates/M9 deferral, review checklist and artifact index.

## Verification

### Existing final non-live product verification (read, not rerun by U7)

From `full-verification.md` at approved verification head:

- `pnpm typecheck` — PASS, 16/16 Turbo tasks.
- `pnpm lint` — PASS, 10/10 tasks, 0 errors and 145 warnings.
- `pnpm test` — PASS, 675/675 tests across 110 files where test scripts exist; Portal passed with `--passWithNoTests`.
- `pnpm --filter @school/convex typecheck` — PASS.
- `pnpm --filter @school/convex lint` — PASS.
- `pnpm build` — PASS, all six Next apps.
- `node scripts/audit-theme-colors.mjs` — PASS, informational.
- `git diff --check f6fc7c4` — PASS.

No e2e/seed command was part of that run.

### U7 commands and results

- `tailscale ip -4` — PASS; current IPv4 recorded above.
- Sites start command above — PASS; Next 16.2.4 reported Local `http://localhost:3005`, Network `http://0.0.0.0:3005`, ready in 1892ms.
- `netstat -ano | grep ':3005'` — PASS; `0.0.0.0:3005` LISTENING confirmed.
- `curl` checks — `localhost:3005` returned 308 to its configured canonical hostname, `greenfield.schoolos.localhost:3005` returned 200, and raw Tailscale-IP access returned 404 as an unknown hostname.
- `node tmp/u7a-capture-sites.mjs` — PASS after one understood harness correction; ten screenshots, seven HTTP 200 and three HTTP 404, zero page errors.
- `node tmp/u7a-build-manifest.mjs` — PASS; ten captures and 25 explicit blocked requirement groups.
- `node tmp/u7a-build-report.mjs` — PASS; 25 workflow records and ten implementation screenshots.
- `node tmp/u7a-verify-report.mjs` — PASS after `U7a.md` was created; desktop 1440×1000 and mobile 390×844 `file://` views, 10/10 images loaded, no horizontal overflow, workflow filter 4/25 then reset 25/25, all relative links/assets present, zero external network requests, zero console/page errors, and no secret-pattern match.
- `node tmp/u7a-verify-artifacts.mjs` — PASS; manifest/file/hash/count/status agreement, no external asset references, no missing screenshots, and no secret-pattern match.
- `git diff --check -- <U7-owned paths>` — PASS.

The first capture attempt used Chromium's prohibited manual `Host` header and stopped with `ERR_INVALID_ARGUMENT` after earlier files had been written. The harness was corrected to use resolving `*.localhost` hostnames and the complete capture was rerun successfully. The first report integrity run correctly failed because its relative `results/U7a.md` target had not yet been created; this file was created and the same check rerun successfully. No assertion or product behavior was weakened.

## Acceptance status

Completed:

- real available desktop/mobile/keyboard/zoom/error Sites evidence;
- machine and human manifests with hashes and explicit Blocked screenshot requirements;
- responsive, disk-openable local report with no CDN dependency;
- U1–U7 status/workflow/check/gate/PR/commit/artifact coverage;
- truthful matrix update and final result;
- report and artifact integrity checks;
- preservation of unrelated `.gitignore`, `deliverables/school-sponsorship-skill`, session `orch-20260905-170029`, and all non-owned servers/processes.

Remaining due to the documented gate:

- all authenticated Platform/Admin/Teacher/Portal journeys;
- denied/cross-branch/modal/retry/re-auth/conflict states that require an authorized target/account;
- real report-card, audit and finance Print / Save as PDF evidence;
- provider/upload/payment/AI/OCR/DNS/mailbox runtime evidence;
- authorized schema/index/cron/function rollout and any reviewed migration.

M9/F4 remains intentionally deferred and not implemented. U7 does not infer independent-school transfer completion from U6 within-group transfer.
