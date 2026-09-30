# PR #88 final panel branch follow-up

The Admin report-card panel now sends the selected `schoolId` with its term-settings and class queries and with comments, defaults, group save and group delete mutations. The form remounts when its branch or report tuple changes, clearing old comments, group selection, errors and term-settings readiness while the new branch loads. The group delete button also has an accessible label.

The four staff endpoints now accept an optional school ID. They pass it into `getAuthenticatedSchoolMembership` with their existing capability checks. Term settings retain `assertAdminForSchool`; comments retain their existing teacher assignment check and Admin-only head-teacher comment check. Existing term, class, student, session and group tenant validation remains. No-argument callers still resolve the default membership. The Admin selector's existing Admin-only authorization was not changed.

New Convex integration tests cover selected and default branch reads and writes, comments, defaults and group create/delete, foreign-school denial, and cross-branch tuple and group rejection. Component tests cover all panel query and mutation arguments and clearing an old draft and selected group when the branch changes.

Verification passed: Convex and Admin typechecks; 11 focused Convex tests and 7 focused Admin tests; targeted ESLint; `git diff --check`. The informational theme audit ran. In the touched panel, rose and emerald are semantic warning/error and success colours, amber is warning, and indigo is a product control. Slate and white are product neutrals. No tenant brand colours changed.

No `portal.ts`, FR-023, commit, push, merge or deploy work was done in this follow-up. The worktree already contained other PR #88 changes when this task began; they were left in place.
