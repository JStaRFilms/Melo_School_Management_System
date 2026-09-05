# G0 inventory result

Status: **documentation inventory complete; implementation and runtime acceptance not performed**.

## Delivered

- `ui-coverage-matrix.md`: 36 requirement rows, all 12 requested columns, actual API/shared-component/route seams, permissions, missing states, existing test locations, evidence gaps and accountable packets.
- `implementation-plan.md`: decisions/trade-offs, dependency graph, exact ownership, serialized shared seams, PR boundaries, route reconciliation, tooling/safety gates and acceptance handoff.
- `packets/`: 23 complete bounded U1–U7 packets (U1a–g, U2a–d, U3a–d, U4a–b, U5a–d, U6a, U7a). Group creation, group default governance and group aggregates are separate assignments; commercial/usage/library/Trash are separate PR boundaries.

## Most important actual-code findings

- Shared branch/denied/draft/progress/theme primitives and the named foundation API modules have no application callers in the inspected source search. Existing routes largely use older APIs; no missing UI is marked complete.
- Bank list authorization falls through to masked metadata after denial; numbering policy read lacks authorization. Both require correction before exposure.
- Group creation assigns the caller person as proprietor; Platform needs explicit intended-owner selection. Group metadata is not an aggregate dashboard or a settings-inheritance implementation.
- Existing grading UI strips color through legacy interfaces; report and score consumers use hard-coded grade mappings. Admission allocator is called by transfer, not ordinary enrollment; invoice bank snapshot helper is already invoked by billing issuance.
- Real import workbench uses migrationWorkspace/Ingest/Autosave/Merge, not aiImport. Separate aiImport lacks complete placement/missing-number semantics. Reuse actual workflow with a reviewed adapter, not a parallel fake importer.
- Sites uses static hostname-resolved public configuration with no Convex dependency. Theme derivation adoption and live branch-theme synchronization are distinct outcomes.
- Root Playwright global setup runs a Convex seed. Acceptance requires an isolated no-seed harness and verified development targets/personas.

## Verification performed

Source/route/API/type/test/config reconnaissance only. Read the required authored task/master plan, parent product decisions/coverage, D02/D03/D04/D05, realistic school test book, root AGENTS, Convex generated guidelines and Takomi skill/Genesis playbook. No discovery interview reopened.

Local documentation checks:
- 23 packet IDs resolve every packet reference in plan/matrix/packets: PASS.
- All packets contain objective, context, ownership/dependencies, instructions, definition of done/verification and artifacts: PASS.
- Matrix has 12 requested columns consistently: PASS.
- UTF-8/whitespace check across 25 primary authored artifacts: PASS.
- `git diff --check`: exited successfully, but session files are untracked, so the explicit per-file documentation check above is the relevant whitespace evidence.
- A first local Python check encountered Windows default text encoding; rerun explicitly as UTF-8 succeeded. No product files changed.

No tests, typechecks, builds, servers, browser logins, screenshots, environment/credential reads, Convex commands, provider requests, migrations, deployments, commits or PR creation were performed. Node/pnpm, Playwright package/browser-cache presence were observed, not browser operability or account authorization.

## Autonomous handoff

Parent can start U1a, then execute the dependency graph; no further planning approval is requested. U3a may prepare its isolated shared framework while the U1a contract is finalized, but backend/context integration waits for that contract. Parent retains delegation, reviews, worktrees and PR operations. Real development-target/account, legacy parity/migration, counsel, DNS/mail-provider, payment, AV and PDF-runtime gates remain open and must not be relabeled complete.
