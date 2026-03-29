# Class-Activated Subject Aggregation

## Goal

Allow a school admin to configure an umbrella subject for specific classes so multiple component subjects can roll up into one reported subject, while teachers still record scores for each component subject separately.

The feature must support:

- any number of component subjects inside one umbrella subject
- class-by-class activation instead of school-wide activation
- different score combination models per aggregation
- existing stand-alone subjects continuing to work unchanged in classes that do not use aggregation

## Problem Statement

Some schools treat a reported subject as a bundle of other subjects for selected classes. Example:

- `Population Studies` may be reported as one subject for `Class A`, `Class B`, `Class C`, and `Class D`
- the component subjects might include `Home Economics`, `Agric`, and others
- students still sit separate exams for each component subject
- the final reported score may be derived in more than one way:
  - components may share a split contribution such as `20/20`
  - components may each keep their own full assessment structure and then be combined into one final umbrella score

The current system does not support this because:

- `assessmentRecords` stores one record per `subjectId`
- `schoolAssessmentSettings` is school-wide and assumes one scoring model for all sheets
- report cards currently summarize subjects as flat stand-alone rows

## Non-Goals

- changing the behavior of classes that are not explicitly configured for aggregation
- removing or hiding the component subjects from score-entry history
- replacing stand-alone subject workflows for schools that do not use aggregated reporting
- changing grading bands away from the current `0-100` report-card expectation unless explicitly configured later

## Current Regression Risks

Any implementation must preserve:

1. existing stand-alone subject exam entry for all non-aggregated classes
2. teacher assignment checks tied to class and subject
3. student subject selections and class subject setup flows
4. report-card generation for classes that have no aggregation configuration
5. grading-band derivation from a final normalized score

## Proposed Model

### Core Idea

Keep component subject recording separate, then add a class-level aggregation layer that computes a derived umbrella-subject result for report cards and class summaries.

This keeps the current subject-level exam entry model intact while allowing one final displayed subject row to represent many component records.

### Aggregation Scope

Aggregation is activated per class, not per school.

- `Primary 5` can use an umbrella subject
- `Primary 6` can keep the same component subjects stand-alone
- the same subject may be aggregated in one class and remain normal in another

### Aggregation Structure

Each aggregation configuration contains:

- one `umbrella subject`
- one target `class`
- many `component subjects`
- one calculation rule for how component scores produce the umbrella score
- optional display settings for whether component rows appear on the report card as hidden, shown as breakdown only, or shown as informational rows

### Umbrella Subject Recommendation

Recommended approach:

- keep the umbrella subject as a real record in the shared `subjects` catalog
- treat it as a derived, non-enterable subject for classes where aggregation is active
- do not allow teachers to record raw scores directly against the umbrella subject

Why this is the safest fit for the current system:

- report cards, naming, and subject references can reuse the normal `subjects` table
- the same umbrella subject can still stand alone in other classes if a school wants that later
- exam-entry logic stays clean because only component subjects remain editable sheets
- we avoid inventing a second subject-like entity that would duplicate catalog behavior

## Implemented Update

This feature is now implemented with the following production behavior:

- umbrella subjects remain real entries in the normal subject catalog
- aggregation is configured per class from the admin class setup screen
- teachers and admins still enter raw scores only for component subjects
- active umbrella subjects are excluded from exam-entry selectors
- direct score entry against an umbrella subject is blocked server-side
- admin and teacher score-entry selectors both use class-scoped subject offerings, so derived umbrella subjects do not appear as selectable raw sheets
- stale derived-subject selections in score-entry URLs are ignored safely instead of crashing the page
- when an aggregation is saved, the system auto-syncs the umbrella subject into existing student selections for class/session combinations that already have all component subjects selected
- staff can still manually deselect the umbrella subject in the subject grid; that explicit opt-out is stored and prevents future silent re-injection
- report cards derive umbrella rows live from component `assessmentRecords`
- report cards inject effective umbrella subjects even when the umbrella was not manually ticked, as long as all component subjects are selected and there is no explicit opt-out
- when a student explicitly opts out of an umbrella subject, the component subjects remain stand-alone on that student’s report card instead of being hidden
- component rows are hidden by default on report cards
- aggregated rows show normalized merged `CA1`, `CA2`, `CA3`, `Exam`, and final `0-100` total
- merged assessment columns are derived from the component sheets using the same class aggregation strategy, so the displayed parts add up to the displayed umbrella total

## Calculation Model

The system should support at least two aggregation strategies from day one.

### Strategy A: Fixed Contribution Split

Use when each component contributes a defined share of the umbrella subject.

Examples:

- `Home Economics` contributes `20`
- `Agric` contributes `20`
- another component contributes `60`

In this model:

- each component record is normalized from its recorded total into its configured contribution share
- the umbrella score is the sum of all normalized component contributions
- the final umbrella score remains out of `100`

### Strategy B: Raw Combined Then Normalized

Use when each component keeps its own full assessment structure and the school wants the combined result to determine the umbrella subject.

Example:

- `Home Economics` keeps a full total
- `Agric` keeps a full total
- all component totals are added together
- the system normalizes the combined raw total back to the umbrella subject scale for grading and report-card display

In this model:

- each component keeps its own scoring rules
- the system stores the raw combined sum
- the system also stores a normalized final umbrella score out of `100`
- report cards display only the normalized `0-100` result, not the raw combined sum

### Required Output Fields

For every aggregated umbrella result, the engine should produce:

- `ca1`
- `ca2`
- `ca3`
- `examScore`
- `rawComponentTotal`
- `componentMaxTotal`
- `normalizedContribution`
- `aggregatedRawTotal`
- `aggregatedRawMax`
- `aggregatedNormalizedTotal`
- `gradeLetter`
- `remark`

## Components

### Client

- `apps/admin/app/academic/subjects/page.tsx`
  - add admin controls to define umbrella subjects and component mappings for a class
- `apps/admin/app/academic/classes/page.tsx`
  - surface whether a class uses stand-alone or aggregated subject reporting
- `apps/admin/app/assessments/results/...`
  - support selecting either component subject sheets or umbrella result views
- report-card screens and printing routes
  - display umbrella subjects correctly for configured classes
  - optionally expose component breakdown beneath the umbrella row
- teacher exam-entry selector flow
  - continue selecting component subjects for score entry
  - avoid presenting umbrella subjects as editable raw sheets unless a future dedicated aggregate screen is added

### Server

- `packages/convex/schema.ts`
  - add aggregation configuration tables
  - add derived aggregate result storage or derivation support
- `packages/convex/functions/academic/academicSetup.ts`
  - manage class-level aggregation setup
- `packages/convex/functions/academic/assessmentRecords.ts`
  - read component subjects with awareness of aggregation membership
  - compute derived umbrella results when saving or when querying report-ready data
- `packages/convex/functions/academic/reportCards.ts`
  - replace flat subject-only assumptions with aggregation-aware result assembly
- `packages/shared/src/exam-recording/*`
  - extend calculation and validation helpers for aggregation formulas

## Data Flow

### Admin Setup Flow

1. Admin creates or reuses normal subjects in the subject catalog.
2. Admin opens class academic setup.
3. Admin chooses a class and enables aggregated reporting for one umbrella subject.
4. Admin selects:
   - umbrella subject
   - component subjects
   - aggregation strategy
   - contribution weights or normalization settings
   - report-card display behavior
5. System validates:
   - umbrella subject is not also a component in the same config
   - component subjects belong to the class
   - component list has at least one subject
   - contribution rules fully define the final score
6. System saves the configuration as class-scoped metadata.
7. The system auto-syncs the umbrella subject into existing student subject selections for eligible class/session rows, while preserving any previously stored manual umbrella opt-outs.

### Teacher Score Entry Flow

1. Teacher opens exam entry.
2. Teacher selects session, term, class, and a component subject.
3. Teacher records scores normally for that component subject.
4. On save, the system upserts the component `assessmentRecords`.
5. The system recalculates any umbrella subjects impacted by that component for the same:
   - school
   - session
   - term
   - class
   - student
6. The recalculated umbrella result becomes available to report-card queries.

### Report Card Flow

1. Report-card query loads stand-alone subject records and class aggregation config.
2. For classes without aggregation config:
   - behavior stays exactly as it is today
3. For classes with aggregation config:
   - the system derives each student's effective subject selection set
   - if all component subjects are selected and there is no explicit umbrella opt-out, the umbrella subject is injected even if it was not manually ticked
   - component records are grouped under their umbrella subject only when that umbrella is effective for the student
   - umbrella totals are calculated or loaded
   - the report uses the umbrella subject row as the official reported result
   - component rows remain stand-alone for students who explicitly opted out of the umbrella subject
4. Summary values such as total recorded subjects and average score use the umbrella result, not double-counted component rows.

## Database Schema

### New Table: `classSubjectAggregations`

Stores one aggregation definition for a class and umbrella subject.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `_id` | id | Convex document id |
| `schoolId` | id | Tenant boundary |
| `classId` | id | Class where aggregation applies |
| `umbrellaSubjectId` | id | The reported subject |
| `strategy` | `"fixed_contribution"` \| `"raw_combined_normalized"` | Aggregation mode |
| `reportDisplayMode` | `"umbrella_only"` \| `"umbrella_with_breakdown"` | Report-card presentation; default should be `umbrella_only` |
| `isActive` | boolean | Allows safe replacement/versioning |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |
| `updatedBy` | id | User id |

Suggested indexes:

- `by_school`
- `by_class`
- `by_class_and_umbrella`
- `by_school_active`

### New Table: `classSubjectAggregationComponents`

Stores the component subjects and their contribution rules.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `_id` | id | Convex document id |
| `schoolId` | id | Tenant boundary |
| `aggregationId` | id | Parent aggregation |
| `componentSubjectId` | id | Stand-alone recorded subject |
| `order` | number | Stable display/calculation order |
| `contributionMax` | number | Used for fixed split mode |
| `rawMaxOverride` | number | Optional raw max when normalization differs from default |
| `includeCA` | boolean | Forward-compatible if a school wants component CA included |
| `includeExam` | boolean | Forward-compatible if a school wants exam-only contribution |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |

Suggested indexes:

- `by_aggregation`
- `by_component_subject`
- `by_school`

### New Table: `studentSubjectAggregationOptOuts`

Stores explicit student/session umbrella deselections so automatic injection and sync do not override intentional staff choices.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `_id` | id | Convex document id |
| `schoolId` | id | Tenant boundary |
| `studentId` | id | Student owner |
| `classId` | id | Class context |
| `sessionId` | id | Session context |
| `aggregationId` | id | Aggregation being opted out of |
| `umbrellaSubjectId` | id | The umbrella subject being suppressed |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |
| `updatedBy` | id | Staff user who triggered the opt-out |

Suggested indexes:

- `by_school`
- `by_student`
- `by_student_class_session`
- `by_class_and_session`
- `by_aggregation`

### Derived Result Strategy

Implemented in this iteration:

- no separate persisted `aggregatedAssessmentResults` table
- umbrella subject results are derived live from component `assessmentRecords`
- report-card queries compute the normalized umbrella row on demand

This keeps the first implementation smaller and preserves the existing score-entry storage model.

## Validation Rules

- A class cannot have two active aggregations for the same umbrella subject.
- A component subject cannot appear twice inside one aggregation.
- An umbrella subject cannot also be listed as one of its own components.
- For `fixed_contribution`, component `contributionMax` values must sum to `100`.
- For `raw_combined_normalized`, component raw maxima must produce a known normalization denominator.
- Only subjects already offered to the class can be used as umbrella or component subjects.
- Teacher score entry remains allowed only for real component subjects assigned to that teacher.
- Umbrella subjects must not create duplicate report-card rows alongside their components unless the display mode explicitly allows a breakdown.

## Backward Compatibility

Classes without active aggregation config continue using:

- `classSubjects`
- `studentSubjectSelections`
- `assessmentRecords`
- current report-card rendering rules

No existing subject needs to be converted globally. Aggregation is additive and opt-in at the class level.

## Migration Approach

### Phase 1

- add new schema tables
- keep current `assessmentRecords` table unchanged
- derive aggregated results from component records

### Phase 2

- update admin class/subject setup UI
- expose aggregation configuration per class

### Phase 3

- make report-card queries aggregation-aware
- make class summaries and averages aggregation-aware

### Phase 4

- optionally add aggregate preview tooling on the exam-entry pages

## Resolved Decisions

1. Umbrella subjects remain real `subjects` catalog records.
2. For aggregated classes, umbrella subjects are derived-only and cannot be score-entered directly.
3. In `raw_combined_normalized` mode, report cards show only the normalized `0-100` score.
4. Component rows are hidden by default.
5. Teacher assignment and exam-entry access remain on component subjects only in this iteration.

## Recommended Build Order

1. Schema additions for aggregation config and derived results
2. Admin APIs for creating and editing class aggregation rules
3. Shared calculation helpers for aggregation strategies
4. Report-card query updates
5. Admin UI for configuration
6. Teacher/admin result views with aggregation-aware summaries

## Definition of Done

- Admin can activate an aggregation for selected classes only.
- One umbrella subject can contain any number of component subjects.
- Teachers still enter scores against component subjects, not fake merged sheets.
- The system derives one final umbrella result per student for aggregated classes.
- Non-aggregated classes continue to behave exactly as before.
- Report cards no longer double-count component subjects when an umbrella subject is active.
- Docs and affected feature files are updated alongside implementation.
