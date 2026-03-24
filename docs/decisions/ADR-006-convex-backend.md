# ADR-006: Single Convex Backend Architecture

**Date:** 2026-03-14  
**Status:** Accepted  
**Deciders:** Architect  

## Context

All four web applications (www, admin, teacher, portal) need a shared backend. The decision involves whether to have a single Convex deployment or separate backends per school/application.

## Decision

**One Convex Backend Deployment:**
- Single `convex/` directory serves all apps
- All business logic centralized (queries, mutations, actions)
- School-aware data boundaries via tenant ID (see ADR-004)
- HTTP actions for webhooks and external integrations

### Structure

```
convex/
├── schema.ts           # All tables (schools, users, students, etc.)
├── auth.ts             # Auth helpers and role checking
├── functions/
│   ├── academic/       # Sessions, terms, subjects, assessments
│   ├── billing/       # Invoices, payments, fee plans
│   ├── users/         # User management, memberships
│   └── webhooks/      # Payment callbacks, external events
```

## Rationale

1. **Shared Logic:** Academic and billing domains overlap; single backend ensures consistency
2. **Cost:** One Convex deployment is cost-effective for initial scale
3. **Realtime:** Convex subscriptions work across all apps with single backend
4. **Maintenance:** One codebase to upgrade, one set of indexes to optimize
5. **Data Integrity:** Transactions span operations without distributed complexity

## Rejected Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| Separate Convex per app | Data silos; complex sync; more cost |
| Per-school Convex deployments | Over-engineering for early stage; operational complexity |
| Hybrid (some in Next.js API) | Lose Convex realtime benefits; split brain |

## Consequences

- All apps connect to same Convex deployment
- Function code size grows; organize with subdirectories
- School isolation is application-level (relies on developer discipline)
- Convex deployment becomes critical path for all apps
- Rate limiting must be configured carefully for multi-app load
- Monitoring and logs centralized (simpler debugging)
