# C5 subject-evidence capacity fix before merge

Owner approved fixing confirmed issue #92 before source merge, without reopening a broad review cycle. The async delegation launch was rejected by the harness path validator before execution; the orchestrator made this narrow change directly.

Class-level selections and assessments now stream their complete indexed ranges while checking unique candidate student IDs against the 80-student roster cap. Subject rows no longer consume a 512-student-like cap. A separate shared 4096-row class subject-evidence budget remains, with a distinct error and no partial publication. Per-student 512-row safety checks and all tenant, conflicting-class, active-term, reviewed-key, frozen roster, exclusion and audit behavior remain unchanged. Nothing is published until all evidence and readiness are verified in the same mutation.

Focused tests: a fully certified 50-student/11-subject class with 550 selection and 550 assessment rows releases all 50; additional candidates discovered after row 512 take the unique roster over 80 and refuse a stale release without writing a publication/inclusion; 4097 subject-evidence rows exhaust the independent read budget and fail closed. Backend typecheck, 17 publication integration tests, targeted lint and diff check passed.

This is a repair of ordinary-class release operability, not a large-class staged freeze feature. Genuinely >80 unique students or transactions exceeding the independent evidence budget still require future reviewed work tracked in #94. #90 source merge does not perform a staged-index backend deployment or backfill; those steps remain in #93. No Convex deployment, data migration or result publication was performed.
