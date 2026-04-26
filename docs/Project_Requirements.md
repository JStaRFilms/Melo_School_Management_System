# Project Requirements Document

## Project Overview

**Name:** School Management System  
**Mission:** Deliver a mobile-first, white-label school operating system for one real school first, with reusable tenant-aware architecture for additional schools later.  
**Tech Stack:** Next.js App Router, TypeScript, pnpm workspaces, Turborepo, Convex, Better Auth, Cypress, OpenRouter

## Product Shape

- Public website per school with shared tenant theming and later custom-domain support
- Four web surfaces: `www`, `admin`, `teacher`, `portal`
- One Convex backend with school-aware data boundaries
- Roles: student, parent, teacher, school admin, platform super admin
- Academic support for both primary and secondary teaching models
- School-fee billing with invoices, installments, manual reconciliation, and online payments

## Terminology

| Term | Definition |
| :--- | :--- |
| **School** | A tenant entity with its own branding, settings, academic year, and billing configuration. |
| **Session** | An academic year (e.g., 2025-2026). Contains multiple terms. |
| **Term** | A grading period within a session (e.g., Term 1, Term 2, Term 3). |
| **Class** | A group of students (e.g., JSS1, Primary 3). Maps to a grade level within a school. |
| **Subject** | A course taught within a class (e.g., Mathematics, English). |
| **CA** | Continuous Assessment. In-term assessments scored before the final exam. |
| **Exam** | End-of-term examination contributing to the final grade. |
| **MUS** | Minimum Usable State. The smallest feature set that makes the product viable for one real school. |
| **Tenant** | A school's isolated data boundary. Every record is scoped to one school. |
| **Platform Super Admin** | The system owner who manages schools, not individual school data. |
| **School Admin** | The operator of one school who manages staff, students, academics, and billing. |

## Functional Requirements

### Platform and Tenancy

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-001 | Tenant-aware school setup | As a platform owner, I want each school to have independent branding, settings, and academic configuration, so that the same codebase can serve multiple schools. | MUS |
| FR-002 | Role-based authentication and routing | As a user, I want to sign in once and land in the correct workspace for my role and school, so that I can start work without confusion. | MUS |
| FR-003 | School administration onboarding | As a school admin, I want to onboard admins, teachers, students, and parents, so that the school can start using the system end to end. | MUS |

### Academic Management

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-004 | Academic structure management | As a school admin, I want to define sessions, terms, classes, subjects, and teacher assignments, so that both primary and secondary workflows are supported. | MUS |
| FR-005 | Student enrollment and parent linking | As a school admin, I want students linked to classes, subjects, and parents, so that learning and billing data reflect the right families. | MUS |
| FR-006 | Assessment and grading engine | As a teacher, I want to enter three CA scores and an exam score with school-defined grading rules, so that averages, rankings, and CGPA are calculated automatically. | MUS |
| FR-007 | Results entry and moderation | As a teacher or admin, I want controlled score entry, editing, and approval workflows, so that published results are accurate and auditable. | MUS |
| FR-008 | Branded printable report cards | As a school, I want printable and portal-ready report cards with comments and branding, so that result delivery is professional and consistent. | MUS |

### User Workspaces

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-009 | Parent and student academic portal | As a parent or student, I want to view results, report cards, and academic notifications online, so that I can track performance without visiting school. | MUS |
| FR-010 | Teacher workspace | As a teacher, I want a dashboard for lesson planning, class work, results, and assessment tools, so that my daily workflow lives in one place. | MUS |
| FR-011 | Public website and admissions-ready content | As a prospective family, I want a polished school website with clear information and calls to action, so that I can learn about the school and contact it easily. | MUS |
| FR-012 | Email and in-app notifications | As a parent, student, teacher, or admin, I want timely notifications for onboarding, results, and billing events, so that I stay informed. | MUS |

### Billing and Payments

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-013 | School fee plans and invoicing | As a bursar or admin, I want to define fee plans, invoices, waivers, and installment rules, so that every student has a clear payable balance. | MUS |
| FR-014 | Manual and online payment tracking | As a school admin or parent, I want both offline and online payments captured against invoices, so that collections and balances stay accurate. | MUS |
| FR-015 | Billing and collections dashboards | As an admin, I want visibility into outstanding balances, paid invoices, reconciliation, and collection status, so that finance operations are manageable. | MUS |

### Intelligence and Quality

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-016 | AI-assisted teacher tools | As a teacher, I want OCR for handwritten lesson notes and AI-generated quizzes/CBTs, so that preparation work is faster and more structured. | MUS |
| FR-017 | Security, permissions, and auditability | As a school owner, I want strong authorization, rate limiting, audit logging, and safe support access, so that sensitive student and payment data stays protected. | MUS |
| FR-018 | Automated verification and end-to-end confidence | As a delivery team, I want repeatable lint, typecheck, build, and Cypress coverage, so that releases are stable. | MUS |

### Future Scope

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-019 | Mobile app support | As a school community, I want dedicated mobile apps, so that the system feels native on phones later. | Future |
| FR-020 | Advanced analytics and stakeholder insights | As school leadership, I want richer academic and financial analytics, so that I can make data-backed decisions. | Future |
| FR-021 | Marketing media pack automation | As the platform owner, I want optional promo assets, decks, and social repurposing, so that new-school onboarding is easier later. | Future |

## User Role Matrix

| Role | Portal | Admin | Teacher | Public |
| :--- | :--- | :--- | :--- | :--- |
| Platform Super Admin | -- | Full access to school management | -- | -- |
| School Admin | -- | Full access to school operations | -- | -- |
| Teacher | -- | -- | Assigned classes and subjects | -- |
| Parent | Linked student data | -- | -- | -- |
| Student | Own academic records | -- | -- | -- |
| Prospective Family | -- | -- | -- | School website and admissions |

## Product Language

### Naming Conventions

- **School** (not "institution" or "organization")
- **Session** (not "academic year" in UI copy)
- **Term** (not "semester" or "period")
- **Class** (not "grade" or "form")
- **CA** (not "continuous assessment" in UI labels)
- **Report Card** (not "result sheet" or "transcript")
- **Portal** (not "student app" or "parent app" in user-facing copy)

### User-Facing Language

- Use plain, non-technical language in all screens
- Avoid exposing "tenant," "MUS," or internal implementation terms
- School branding takes precedence: the product name is the school name, not "School Management System"

## Constraints

- One school first, multi-school ready without rewrite
- Mobile-first design; desktop is enhancement
- Payment integration provider-agnostic in structure but Paystack-first
- Support access is read-only by default
- Academic model supports both primary and secondary teaching patterns
- Teacher planning launches from context first: `Subject -> Level/Class -> Term -> Topic` for lesson and quiz work, and `Subject -> Level/Class -> Term -> Exam scope` for exam drafting; the library remains a repository, not the primary authoring entry point.

## Definition of Done

- `docs/Project_Requirements.md` is complete and readable.
- FR numbering is sequential and stable.
- The document can support design and build without further product invention.
- Every FR has id, description, user story, and status.
- Payments are represented in the PRD.
