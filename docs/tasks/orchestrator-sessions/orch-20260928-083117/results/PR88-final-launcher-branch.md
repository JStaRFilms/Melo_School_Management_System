# PR88 final launcher branch follow-up

Fixed the three Admin academic selectors used by `ReportCardLauncher`. `getAdminSessions`, `getTermsBySession`, and `getAllClasses` now accept an optional `schoolId`, resolve membership with `ACADEMIC_CONTEXT_CAPABILITIES`, and retain `assertAdminForSchool`. Omitted IDs still use the existing default membership. Teacher and Exam Officer selectors were not changed.

The launcher sends its selected school to all three selectors. It only uses session, term, and class IDs found in the returned options for roster queries and links. On a branch remount, it cannot request the old roster while the new branch options load. The report-card page's existing branch-key remount and tuple-clearing guard still protect the preview.

Tests cover default and non-default school-admin selectors, cross-branch session rejection, a school without membership, teacher denial, and a launcher switch from a visible old roster to a loading new branch. Checks passed: Convex and Admin typechecks; 16 focused Convex tests and 5 focused Admin tests; `git diff --check`. The theme audit ran. In the touched launcher, indigo is an existing product-control colour; slate and white are product neutrals. The other files reported by the audit have pre-existing semantic status, product-neutral, or print-only colours; no tenant branding or colour rules changed.

No FR-023 edits, commit, push, merge, or deploy. Remaining scope: other Admin screens still use the intentional no-arg selector default, as requested.
