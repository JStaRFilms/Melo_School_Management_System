# R1 final review result

## Disposition: request changes

Verified the requested worktree and all three frozen refs. One confirmed blocking requirement violation.

### P2: confirmed household admissions cannot recover a lost response

**Locations**
- `apps/admin/app/academic/students/onboarding/page.tsx:137`
- `apps/admin/app/academic/students/page.tsx:846`
- `packages/convex/functions/academic/studentEnrollment.ts:735–763`

Both admission screens append `confirmDuplicateLink` per invocation instead of retaining it in the frozen request. After household confirmation, the committed request contains `true`. A normal retry sends `undefined` with the same request key.

The backend fingerprints that flag, so it rejects the retry with “Enrollment request intent changed” rather than returning the committed student.

**Reproduction**
1. Select a contact requiring household confirmation.
2. Confirm and allow enrollment to commit, but lose its response.
3. Click “Retry reviewed admission”.

I executed the unchanged standalone submit function in memory with simulated response loss. Its calls used the same key but flags `true` then `undefined`. Executing the actual backend fingerprint function confirmed different hashes. The roster contains the same defect.

**Minimal fix:** retain confirmed household intent in the frozen payload and replay it unchanged. Add focused coverage for response loss after confirmation. Do not weaken backend content-bound idempotency.

## Acceptance limits

- Isolated browser acceptance remains blocked by the documented missing `.env.qa.local`. No browser, mobile-layout, provider or delivery acceptance is claimed.
- Unlinked legacy-admin notices intentionally fail closed. Existing photo-transport restrictions remain. Secure setup/reset links remain deferred.
- PR3 uses immediate atomic apply-and-consume, not a second approval step. No additional confirmed blocker found in the focused source review.

No files changed, Git writes, deployments or nested delegation. Parent test suites were not duplicated.
