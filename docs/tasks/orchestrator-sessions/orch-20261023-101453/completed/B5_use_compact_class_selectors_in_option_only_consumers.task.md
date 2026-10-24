# Use compact class selectors in option-only consumers

## Objective
Reduce response bytes and database I/O for class dropdown consumers without changing listClasses for its full-detail consumers.

## Evidence and scope
Production-class listClasses recorded 822 calls and 42566205 internal read bytes. Onboarding needs _id/name/level; knowledge library/templates/curriculum-readiness need class names and gradeName only. They currently trigger per-class pupil collections and subject/teacher lookups. Implement a separate compact listClassOptions query in academicSetup with the same academic-context membership and admin checks. Keep complete active class results, established display-name/level/grade normalization and ordering. Update only those four consumers and their affected tests. Full listClasses stays unchanged for dashboard/classes/roster.

## Definition of done
Synthetic tests compare selector output to corresponding listClasses fields, cover absent/false/true archive flags, denial and foreign-school exclusion, and report query/document byte proxies plus serialized response bytes. No pupil/subject/teacher detail queries in compact selectors. Frontend component tests pass and all consumers use the compact function consistently.

## Expected artifacts
Small additive backend API and consumer edits, focused backend/component tests and local before/after measurements. No schema/index or persistent flow change and no deployment.
