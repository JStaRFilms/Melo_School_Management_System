# Skip unrelated archive history reads

## Objective
Reduce archive query database I/O without changing its API, complete search data, tenant scope or scoring-lock redaction.

## Scope
Only archiveRecords.ts and focused archive regression tests. Read core record tables first. Fetch archived knowledge materials through existing by_school_and_review_status. Read supporting terms, class-subject links, teacher assignments, selections, assessments and topics only when archived record types need them. Prefer narrow existing indexes for terms, assignments and material topics. Preserve all returned fields and linked-history counts; do not truncate lists or add indexes. No consumer/API redesign.

## Definition of done
Archive outputs remain equivalent for mixed archives and locked sessions. Empty archives and event/material-only archives avoid assessments and unrelated history collections. Authorization failures still happen before data scans. Focused tests cover these properties with synthetic fixtures.

## Expected artifacts
Small backend diff and focused tests, with query/document/serialized-size evidence or a clear measurement limitation. No deployment or integration setup.
