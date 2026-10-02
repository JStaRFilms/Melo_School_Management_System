# School lifecycle QA verification

## Result

The complete fresh-fixture lifecycle passed 47 browser criteria plus two independent post-run preservation checks. Latest run: `qa-1790984407360-e51d3690`. All business writes were driven through the actual Admin or Teacher UI on `content-poodle-172`.

- Created a tagged inactive session, one standalone term, one class, one placeholder pupil, and a reviewed link to the existing synthetic Parent. Existing Teacher and subject were reused; no new credential or email was provisioned.
- Applied a session-only policy of CA 20/20/10 with raw exam /50 contributing /50. The original session was not regraded.
- Invalid CA3 /10 value 11 was rejected by the save path. Cancel/reload cleared the local recovered draft rather than misidentifying local storage as server persistence.
- Saved 18 + 17 + 8 + 40 = 83, Grade A, then reloaded and verified the persisted inputs and calculation.
- Parent saw no report sheet, table, raw 83.00 value, or print controls before release, including after certification.
- Certified an immutable 83 report, then reviewed exactly one eligible/certified pupil, zero exclusions, and confirmed class release. Timestamp/staff label and counts were verified after reload.
- Parent saw the issued 83 report. Teacher later changed the editable exam to 20, producing 63, Grade B; the Parent and Admin issued copies stayed 83.
- Restored the original active `2025/2026 / Third Term` and opened the fixture through its actual history row and report link.
- A4 output was one white page. The generated PDF was independently text-checked and raster-reviewed: pupil/83 present, no sidebar, readable complete report. Raw PDF remains private.
- The mobile screenshot exposed an A4 preview overflowing its container. `ReportCardPreview` now measures available width for its default portal zoom. Explicit Admin zoom is unchanged. The latest lifecycle run confirms the fresh mobile preview fits within 390px; narrow-container and explicit-zoom unit tests pass.

The original 36-pupil/3-class cohort digest remained `a16c74d544d0fffe471402ddee0a8e690c7ba9d1c2b6852a1246f2dc8d67f7f6`. Run-specific pupils/classes/claims and issued records are retained; no generic purge/reset was performed.

## What changed to make this possible

- Ordinary QA now uses a separate exact-target, operator-gated read-only inspector. It verifies original actor/pupil/class ownership and run-tagged additions. The destructive reset preflight remains unchanged and still refuses the additional admission claim.
- Class inspection validates known legacy and UI-normalized grade/section names, not arbitrary display strings. Multiple active periods and unrelated class renames are rejected. Canonical class identity, original student users, scores, issued copies, and invoices are fingerprinted.
- Visiting Classes triggered its preexisting naming backfill. This normalized original display labels. The logical cohort and all original score/report data remained preserved; it was not a zero-write browse. Failed duplicate empty setup sessions were specifically archived through UI and their journals retained.
- Cross-role phases have unique IDs, ordered dependencies, distinct context/evidence names, and in-memory role-session reuse. Each cached session is independently validated before phase actions. Nothing writes session cookies to an evidence file.
- Cleanup runs after ordinary phase failures. Hard interruption/timeout creates a recovery marker and blocks normal reruns until the recorded calendar and baseline are independently verified, or an explicit recovery UI workflow completes. A module's declared target does not override the original preservation check.
- Screenshot review found the fixed default preview scale exceeded mobile width. The preview now auto-fits only when no explicit staff zoom is supplied. Narrow-container and explicit-zoom unit tests passed, and the fresh mobile report fits the viewport in live browser proof.

## Checks and limits

- QA script tests: 32 passed, including cross-role dependencies, interruption accounting, recovery gating, and skill links.
- Convex inspector integration: 7 passed, including preserved reset blocking, wrong-deployment refusal, normalized labels, unrelated rename rejection, and ambiguous active-period rejection.
- Responsive preview unit tests: 2 passed.
- Typechecks/lint are recorded in the task completion notes; this does not claim every upstream feature or all seven apps are browser-tested.
- Independent review identified inspector name masking, active-period target override, timeout cleanup, and weak assertions. Those were fixed with stronger checks and recovery gating before the latest complete run.

Test dates are generated relative to run time. Each normal lifecycle invocation creates a fresh tagged fixture rather than pretending a previously released fixture can replay the pre-release privacy criteria. Failed runs and raw artifacts remain private.

## Evidence and shipping

Review HTML and PNGs before `qa:report --publish-reviewed`. Authenticated traces, session data, raw videos, PDFs, and credentials are not automatically published. The rendered A4 PNG is a reviewed derivative, not a public raw trace.

Shipping is still blocked. Repository inspection found no GitHub workflow or checked-in Vercel deployment hook; root builds do not call Convex deployment. GitHub lists Preview and Production-named Vercel deployment records for current master, but the returned flag is `production_environment: false` and their URLs are immutable deployment URLs. Cached Vercel project inspection returned HTTP 403, so provider build overrides, project production branches, and alias promotion behavior remain unverified. No QA branch push, remote PR, production operation, or normal-development write was performed.

A local PR packet is prepared in `deliverables/qa-browser-workflows-pr.md`. Before the push, confirm provider-side preview builds cannot write to production Convex; the current GitHub metadata alone does not establish that. Platform, Apply, WWW, and Sites fixture/origin journeys remain the next milestone, not silently included in this result.
