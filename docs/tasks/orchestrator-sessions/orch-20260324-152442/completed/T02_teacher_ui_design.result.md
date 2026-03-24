# T02 Teacher UI Design - Result

**Completed:** 2026-03-24  
**Status:** Complete

## Outcome

The teacher-side exam-entry design artifacts now satisfy the T02 brief for both desktop/tablet and mobile-first review.

## Verification

| Check | Status |
| :--- | :--- |
| Teacher exam-entry route represented in sitemap | Passed |
| Teacher mockup exists under `docs/mockups/teacher/` | Passed |
| Main grid shows `CA1`, `CA2`, `CA3`, `Exam`, `Total`, `Grade`, and `Remark` | Passed |
| `/60` mode shows read-only scaled `/40` contribution | Passed |
| `/40` mode is explicitly represented without the scaled column | Passed |
| Loading, empty, saved, and error states are present | Passed |
| Mobile-focused entry variant is present | Passed |

## Notes

- Desktop variants now explicitly document both `raw40` and `raw60_scaled_to_40` behaviors.
- Mobile mockups show the active `/60` flow plus a `/40` alternative so downstream implementation tasks do not need to infer the mode switch.
