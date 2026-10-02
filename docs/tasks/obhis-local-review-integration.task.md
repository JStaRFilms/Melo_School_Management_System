# Integrate the approved OBHIS homepage locally

## Objective

Port the approved private homepage into the existing Next.js sites app as a code-owned renderer. Keep the approved design and motion, without publishing school facts or private photographs.

## Scope

Work only on branch `feature/obhis-website` in this worktree. Read applicable AGENTS files, `docs/features/OBHISLocalHomepageReview.md`, ADR-009, the shared-core feature document, the content approval sheet and current sites code before editing. Use the approved HTML, its two stylesheets and two controllers as the visual and behavioral source. Read current shared theme/admissions contracts. Do not examine or modify Convex implementation unless necessary; read its generated AI guidelines first if doing so.

Implement a minimal app-local exact renderer registry/context and a distinct validated read-only private fixture. Add a development-only `/review/obhis` page and exact-key asset endpoint, then a scoped `renderers/obhis-v1` homepage with React-safe lifecycle-managed interactions. Add isolated sites-only headless tests/configuration. Update the local-review feature document with setup and actual check results.

## Hard boundaries

- Preserve the original prototypes, generated images, source/output provenance and untracked Blender work.
- Do not modify generic site.ts/site-ui.tsx, existing catch-all/proxy/SEO, shared theme contracts, Convex/schema/auth, admissions domain logic, root/global routing settings, package dependencies, or other applications.
- Both page and asset delivery require NODE_ENV=development and explicit server-only opt-in. Deny production even if opted in, before filesystem reads. Bind owned servers to 127.0.0.1. No Host-header security claims, personal profiles, desktop control or existing-process termination.
- Assets stay in their current docs review directories. No public copies, client imports, Next optimizer URLs, unbounded filesystem paths or production file tracing of private images. Exact asset-key allowlist and no-store responses only.
- School identity/facts/photo rights remain pending. Do not consume fabricated obhisSchool demo content, invent contacts/fees/programmes/campus facts, or synthesize published revisions/approved rights. No forms or payments.
- Tenant configuration has only primaryColor/accentColor; derive actual UI tokens with @school/shared/theme. Preserve the approved green controls and cyan chapter using these inputs. The private study's remaining illustration colours may stay fixed in scoped renderer art CSS, never become extra configurable tenant roles. Document their private-study status. Use school contrast tokens on branded controls/fills. Do not silently change the inherited coral hero composition or claim its known display-text contrast issue resolved.
- Unknown renderer keys or versions fail closed. No generic page builder, remote module loading, fallback to another school or new abstract framework.
- No OBHIS application URL exists. Keep the existing guidance/disclosures; core owns future canonical ApplicationLinkV1 values. Renderer never constructs an application URL.
- Scoped styles must account for existing Tailwind/global heading resets while preserving the approved visual. No new external fonts or scripts.
- Preserve accessible names, inert/hidden panel states, focus settlement, rapid reversal, URL/history/reload, manual album controls, modified-click link behavior, native viewer focus/Tab/Escape, visit reopening, reduced motion and all-photo no-JS fallback. Do not paste document-global scripts into React. Clean up listeners/frames/dialog state on unmount and Strict Mode remount.

## Definition of done

- Approved homepage works through the local Next route at 1440/1024/768/760/390/320px with no overflow or content shift when choosing a hero or photo collection.
- Development opt-in off, production opt-in on, unknown asset keys and traversal deny private content. Production output/traces contain no private review image bytes/files.
- Existing demo hosts, aliases, unknown/inactive behavior and SEO remain unchanged.
- Typecheck, focused lint and isolated headless checks pass; informational theme audit is classified, not used for global replacements.
- Original approved source files are byte-identical to the starting commit. All changes remain scoped and no push/deploy occurs.

## Expected artifacts

Scoped renderer/core/review-route files in apps/sites, isolated e2e/config files, updated local-review feature document, and a concise report of changed files, tests and real limitations. The core/context is only the bounded private-review slice, not the final persisted B4 contract.

## Execution and handoff

Use OpenAI Codex GPT-6.1 Sol High according to GLOBAL routing. Project-local routing overrides were deliberately removed; do not recreate them or follow cached local policy notes. Use existing dependencies. One implementation pass, then one focused independent review. Fix only confirmed correctness/security defects or explicit requirement violations.

The previous read-only assessment failed report parsing because a command result used `timed out`. If emitting acceptance-report JSON, commandsRun.result must be exactly `passed`, `failed`, or `not-run`; describe timeouts in detail text and mark failed. Do not claim a timed-out or unrun check passed. Return a valid checked report and do not patch installed Takomi tools.
