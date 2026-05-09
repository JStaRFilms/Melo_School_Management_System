# Standalone Study App Discovery Brief

**Status:** Discovery only; not approved for implementation.
**Created:** 2026-05-08
**Source:** DevLog DL-027 / Task 10, Project Requirements FR-009, FR-016, FR-019, portal foundation, and Lesson Knowledge Hub v2 planning docs.

## Purpose

Explore a future study app that can work independently for learners while optionally integrating with Melo school accounts when a learner belongs to a Melo-powered school.

This brief defines product boundaries, identity models, data ownership, privacy constraints, and open questions for a later planning session. It does not authorize app, schema, Convex, portal, or mobile implementation work in the current DevLog session.

## Product Principle

The app should be useful without a school connection, but become more contextual when linked to Melo.

- **Standalone first:** learners can study, practice, track progress, and build habits without school setup.
- **Melo-aware when linked:** learners and parents can connect to official school context, approved learning resources, and class/subject alignment.
- **School records remain authoritative:** official classes, enrollments, assessments, report cards, billing, and school communications stay in Melo tenant-owned systems.
- **Privacy by default:** standalone activity is not visible to schools, parents, classes, or public communities unless consent and permissions explicitly allow it.

## Capability Separation

### Standalone app capabilities

These capabilities belong to the independent study product and should not require a Melo school:

- Learner account setup with age-appropriate onboarding and optional parent/guardian involvement.
- Personal study profile: goals, preferred subjects, level, exam targets, interests, and schedule.
- Personal topic library and study plan across generic subjects/curricula.
- Practice quizzes, flashcards, explanations, revision sessions, streaks, achievements, and personal progress metrics.
- Personal notes, bookmarks, saved explanations, and uploaded study references where legally allowed.
- Optional community features such as challenges, discussion, or peer groups, subject to moderation and child-safety design.
- Game scores and leaderboards limited to standalone scopes unless a school explicitly opts into a school/class scope.
- Export/delete controls for standalone profile data and generated study artifacts.

Standalone mode must not assume access to official school records, report cards, teacher resources, billing records, or class membership.

### Melo-integrated capabilities

These capabilities require account linking to a Melo school identity and must preserve school tenant boundaries:

- Link a standalone study profile to a Melo student/parent portal identity.
- Resolve explicit school and child context for parents with multiple children or multiple schools.
- Import or reference official context such as enrolled class, subjects, term, and approved topic map.
- Recommend study topics based on school class/subject/term alignment.
- Surface approved portal-facing resources from the school knowledge hub using existing approval and visibility rules.
- Let parents view child study activity only where consent, age rules, and account relationship allow it.
- Support school/class challenges or leaderboards only when the school opts in and participants have appropriate visibility controls.
- Optionally send limited study engagement summaries back to Melo dashboards in a future phase, if schools and users consent.

Integrated mode must not let students or parents edit official enrollments, scores, report cards, invoices, teacher materials, or school-owned records from the study app.

## Identity Models

| Identity | Description | Key boundary |
| --- | --- | --- |
| Standalone learner | A learner using the app without Melo linkage. | Owns personal study data only; no school record access. |
| Standalone parent/guardian | A guardian supervising one or more standalone learners. | Visibility depends on consent, age policy, and family relationship. |
| Melo student | A student account linked through a Melo school tenant. | Can see only own school-authorized portal context. |
| Melo parent | A parent linked to one or more Melo students, potentially across schools. | Must choose explicit child/school context; no cross-school leakage. |
| Hybrid learner | A standalone learner who links to one or more Melo student identities. | Personal study profile remains separate from official school records. |
| School-linked cohort | A class, subject, or school challenge scope powered by Melo. | Participation and metrics are school-scoped and opt-in. |

Account linking should be reversible. Unlinking removes future access to school context from the study app but must not delete school-owned records.

## Data Ownership and Privacy Boundaries

### Standalone-owned data

Owned by the learner/guardian relationship and governed by the study app terms:

- Study profile, goals, preferences, schedule, streaks, achievements, and game scores.
- Personal practice attempts, quiz answers, flashcards, notes, bookmarks, and generated explanations.
- Personal uploads or references added directly to the study app.
- Standalone community identity, posts, reactions, reports, and moderation history.

Users should be able to export or delete standalone-owned data subject to legal, safety, fraud, and moderation retention requirements.

### Melo school-owned data

Owned by the school tenant and governed by Melo school permissions:

- School identity, branding, sessions, terms, classes, subjects, enrollments, and teacher assignments.
- Official assessment records, report cards, comments, rankings, and moderation states.
- Parent/student links created by the school.
- Billing records, invoices, payments, receipts, and reconciliation data.
- School-uploaded knowledge materials, teacher drafts, approved portal resources, and school communications.

The study app may read or reference these records only through explicit, permission-checked integration paths. It must not copy broad school data into standalone storage without a defined purpose, retention limit, and audit trail.

### Shared/integrated data

Some app data may be produced while linked to Melo:

- Topic completion against a school-aligned topic.
- Practice scores for a school subject.
- Participation in a school/class challenge.
- Parent-facing engagement summaries.

Default ownership should be **standalone-private** unless a future product decision creates a school-visible scope. If school visibility is added, each metric must define who can see it, which school/child/class context it belongs to, whether it is individual or aggregated, retention/deletion behavior, and whether it can affect official school records.

No study-app metric should affect official grades, report cards, billing, or promotion decisions unless a later school-approved assessment product explicitly defines that workflow.

## Integration Boundaries

Future integration should be designed as a narrow bridge, not a merged database:

- Use explicit account-linking flows rather than implicit email matching.
- Keep standalone study profile IDs separate from Melo `students` records.
- Require `schoolId` and selected child/student context on every school-scoped read.
- Treat Melo knowledge resources as read-only unless a school user edits them inside Melo.
- Label school-originated content with school and class context in the study app.
- Cache only the minimum school context needed for performance, with clear invalidation when a user unlinks or loses access.
- Audit link, unlink, school-context reads, and school-visible metric writes.

## Community, Game Scores, and Metrics

- Standalone leaderboards should avoid exposing real names by default, especially for minors.
- School/class leaderboards require school opt-in and participant visibility rules.
- Community content needs moderation, reporting, blocking, age segmentation, and escalation policies before launch.
- Public or cross-school communities must never reveal a learner's school, class, report-card data, billing status, or parent identity.
- Aggregated metrics for schools should be privacy-preserving and should not expose unrelated standalone activity.

## Relationship to Existing Melo Surfaces

- The current **portal** remains the official parent/student surface for results, report cards, billing, notifications, and approved learning resources.
- The **Lesson Knowledge Hub** remains the teacher/admin repository and planning system. The study app can consume approved portal-facing resources later but should not become the authoring workflow.
- Teacher planning remains context-first: `Subject -> Level/Class -> Term -> Topic` for topic work and `Subject -> Level/Class -> Term -> Exam scope` for exam work.
- The study app should not replace the portal until a future product decision explicitly changes the role matrix.

## Non-Goals for the Current DevLog Session

- No new app, package, route, Convex schema, API, auth flow, or mobile app work.
- No changes to portal, teacher, admin, or public website behavior.
- No PDF parser/OCR upgrade; Task 09 was explicitly deferred by the user for a future session.
- No community, leaderboard, analytics, or AI tutoring implementation.
- No migration of existing portal or knowledge hub data.

## Open Product Questions for Future Planning

1. Is the standalone study app a Melo-branded companion, a separate consumer brand, or both?
2. Who is the first target user: primary pupils, secondary students, exam candidates, parents, or schools?
3. Which curricula/exam standards should standalone mode support first?
4. What minimum age and guardian-consent rules apply in launch markets?
5. Should standalone accounts support social/community features at launch, or should those wait?
6. What data, if any, should schools be allowed to see about a linked learner's study activity?
7. Should learners control school visibility themselves, should parents control it, or should school policy control it?
8. Can a learner link multiple schools or past schools to one study profile?
9. What happens when a student changes class, graduates, transfers, or is archived in Melo?
10. Should school-approved resources be available offline or cached in the standalone app?
11. How should content licensing work for school-uploaded materials shown outside the portal?
12. Are game scores purely motivational, or can schools create official challenges?
13. Should parents be able to assign practice work independent of school assignments?
14. Should teacher-created quizzes ever flow into the study app as practice, and under what approval state?
15. What AI features are acceptable for minors, and can user data be used to improve prompts/models?
16. What monetization model is intended: school subscription add-on, parent subscription, freemium, or bundled access?
17. What deletion/export obligations apply to hybrid accounts with both standalone and school-linked data?
18. What success metrics define the first useful release?

## Future Planning Outputs Needed

Before implementation, create:

- A product requirements document for the study app MVP.
- A privacy and child-safety policy brief.
- An account-linking and consent flow design.
- A school-visible metrics policy.
- A data model proposal that separates standalone, school-owned, and shared integration records.
- A migration/non-migration decision for portal learning resources.
- A launch plan deciding web-first vs mobile-first implementation.

## Discovery Acceptance Checklist

- [x] Standalone capabilities are separated from Melo-integrated capabilities.
- [x] Data ownership and privacy boundaries are explicit.
- [x] Open product questions are listed for a future planning session.
- [x] Current-session implementation is explicitly out of scope.
