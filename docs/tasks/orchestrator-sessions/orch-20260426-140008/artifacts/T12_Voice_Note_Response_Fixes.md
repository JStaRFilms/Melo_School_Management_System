# T12 Voice Note Response Fixes

Session: `orch-20260426-140008`  
Stage: Build polish / verification  
Date: 2026-04-26

## User feedback addressed

1. **Task files still appeared pending**
   - Moved task markdown files from `pending/` to `completed/`.
   - Updated task status fields to `completed`.
   - Checked completed task checkboxes.
   - Updated `master_plan.md` lifecycle and task statuses.

2. **Planning was not reachable from the sidebar**
   - Added a dedicated `Planning` sidebar item for `/planning`.
   - Kept `Library` as a separate repository link at `/planning/library`.
   - Adjusted matching so Library does not absorb the whole planning section.

3. **Topic field was dropdown-only and could not create a new topic**
   - Replaced the topic-only dropdown in the planning hub with a creatable topic picker.
   - Teachers can now type a topic name, see matching existing topics, select a close match, or create a new topic directly from the planning hub.
   - Added a similar-topic warning so near duplicates are not created accidentally.

4. **Confusion around adding materials from a workspace**
   - In attach mode, uploading a new source now automatically selects that source for the workspace return flow.
   - Upload subject/level defaults from the planning context when available.
   - Exam attach mode defaults to curriculum/cross-topic planning reference behavior.

5. **Title/topic label felt too compulsory and duplicated**
   - Upload title is now treated as optional in practice: if left blank, the file name is used.
   - Topic label is optional in the UI: if left blank, the system uses a safe fallback label.
   - The copy now explains that a real topic attachment is only needed when a source genuinely belongs to one topic.

6. **Pre-existing type/build errors**
   - Re-ran package verification after dependency/build-state cleanup.
   - `@school/teacher` typecheck passes.
   - `@school/convex` typecheck passes.
   - Root `pnpm typecheck` passes after clearing stale generated `.next` state for `apps/sites`.
   - Root `pnpm lint` passes with 0 errors.

## Verification commands

```bash
pnpm --filter @school/shared typecheck
pnpm --filter @school/shared test
pnpm --filter @school/teacher typecheck
pnpm --filter @school/convex typecheck
pnpm --filter @school/sites build
pnpm lint
pnpm typecheck
```

## Result

This pass is ready for manual UI testing. Focus on:

- sidebar `Planning` link
- creating a brand-new topic from `/planning`
- selecting an existing/similar topic from `/planning`
- opening lesson/question workspaces from a newly created topic
- adding/uploading a new material from workspace attach mode and returning with it selected
- leaving upload title/topic label blank and confirming safe defaults are used
