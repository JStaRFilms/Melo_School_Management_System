# Task: Deep review and regression pass

**Task ID:** 09
**Stage:** build
**Status:** pending
**Role:** review
**Preferred Agent:** reviewer
**Conversation ID:** reviewer-09
**Workflow:** vibe-build
**Model Override:** gpt-5.5

## Context

Parent session: orch-20260428-204715

Task title: Deep review and regression pass

## Objective

Perform final review for correctness, regressions, UX consistency, and architecture compliance.

## Scope

- Shared toast API
- Shared AppToaster UI component
- All modified root layouts
- All modified pages/components
- Direct Sonner import scan
- Notification center separation
- Typecheck/lint/build results

## Checklist

- [ ] Review shared toast API for architecture compliance
- [ ] Review system/UI separation: appToast/types/defaults/error-message vs AppToaster styling
- [ ] Scan for direct Sonner imports outside shared toast module
- [ ] Check root layouts for duplicate toasters
- [ ] Check app pages/components do not pass local toast styling or import visual internals
- [ ] Check server/client boundary issues
- [ ] Check toast vs notification-center separation
- [ ] Check validation UX was not degraded
- [ ] Check message clarity and privacy
- [ ] Run typecheck
- [ ] Run lint
- [ ] Run build
- [ ] If any Convex code was touched, read packages/convex/_generated/ai/guidelines.md and run pnpm convex deploy before handoff
- [ ] Document all verification results
- [ ] Route any P0/P1 fixes back to responsible task/agent

## Definition of Done

- No P0/P1 issues remain
- Build/typecheck/lint status is documented
- Convex deploy status is documented if Convex files were changed; otherwise note that no Convex deploy was required
- Direct Sonner usage is limited to shared toast module unless intentionally justified
- Toast visual design can be changed centrally through AppToaster without page-level changes
- The final implementation covers admin, teacher, platform, and portal root layouts
- Final review notes are captured in orchestration docs

## Expected Artifacts

- Review notes in orchestration session
- Any required fixes routed back to relevant task/agent

## Dependencies

- 04
- 05
- 06
- 07
- 08

## Review Checkpoint

Final approval before user handoff.

## Instructions

- Use GPT-5.5 for deep judgment
- Check server/client boundaries carefully
- Check for duplicate toasters
- Check accessibility and message clarity
- Check that the implementation did not conflate transient toasts with persistent domain notifications
- If UI quality needs subjective refinement, route it as a UI-only follow-up against AppToaster rather than reopening the system API
- Route revisions back to same agent conversation when useful
