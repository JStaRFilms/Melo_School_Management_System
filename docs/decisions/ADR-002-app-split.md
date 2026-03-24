# ADR-002: Four-App Surface Architecture

**Date:** 2026-03-14  
**Status:** Accepted  
**Deciders:** Architect  

## Context

The School Management System serves four distinct user groups with different workflows, security requirements, and feature needs. Each group requires a dedicated application surface.

## Decision

Implement four separate Next.js applications:

| App | Path | Purpose | Users |
|-----|------|---------|-------|
| `www` | `apps/www` | Public marketing site, admissions info | Prospective families, public |
| `admin` | `apps/admin` | School operations, setup, full control | School admins, bursars |
| `teacher` | `apps/teacher` | Classroom tools, lesson planning, grading | Teachers |
| `portal` | `apps/portal` | Academic view for parents/students | Parents, students |

Each app:
- Uses Next.js App Router
- Has independent deployment capability
- Shares common packages from monorepo
- Connects to single Convex backend
- Has role-based access control

## Rationale

1. **Security Boundary:** Clear separation between admin operations and teacher/parent views
2. **User Experience:** Tailored UI per user role without feature confusion
3. **Deployment:** Independent deploys (e.g., marketing site updates without app downtime)
4. **Performance:** Smaller bundles per app; no dead code from unused features
5. **Maintenance:** Teams can work on surfaces independently

## Rejected Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| Single app with route-based roles | Complexity in auth; harder to deploy independently; larger bundle |
| Subdomains (admin.school.com) | Requires wildcard SSL; DNS management; more infrastructure |
| Mobile apps only | Web-first requirement; mobile is future phase |

## Consequences

- Shared auth state across apps (Better Auth session)
- Common navigation/UI patterns via shared packages
- Convex functions must be aware of role context
- Four separate builds/deployments to manage
