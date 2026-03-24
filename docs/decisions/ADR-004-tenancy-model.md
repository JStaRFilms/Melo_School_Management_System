# ADR-004: Multi-Tenant School-Aware Architecture

**Date:** 2026-03-14  
**Status:** Accepted  
**Deciders:** Architect  

## Context

The platform must support multiple schools on the same codebase with strict data isolation. Each school operates independently with its own branding, users, academic structure, and billing.

## Decision

**Soft Multi-Tenancy with School-Aware Data Boundaries:**
- Single Convex deployment serves all schools
- Every data table includes `schoolId` as partition key
- Convex functions validate `schoolId` from user session
- Row-Level Security (RLS) enforced at function layer

### Data Model Pattern

```typescript
// Every document includes schoolId
interface School {
  _id: Id<"schools">
  name: string
  slug: string  // unique identifier
  branding: BrandingConfig
}

interface User {
  _id: Id<"users">
  schoolId: Id<"schools">  // required
  authId: string  // Better Auth user ID
  role: "student" | "parent" | "teacher" | "admin"
  // ...
}
```

### Access Pattern

```typescript
// Convex function pattern
mutation({
  args: { /* inputs */ },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUser()
    const membership = await getSchoolMembership(ctx, user.tokenIdentifier)
    
    // schoolId always extracted from membership
    const schoolId = membership.schoolId
    
    // All queries scoped to schoolId
    await ctx.db.query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
  }
})
```

## Rationale

1. **Cost Efficiency:** Single Convex deployment reduces infrastructure costs
2. **Shared Maintenance:** One codebase, one deployment, easier upgrades
3. **Data Isolation:** School ID partition ensures no cross-school data leakage
4. **Scalability:** Convex handles multi-tenant queries efficiently with indexes
5. **White-Label Ready:** Each school has independent branding config

## Rejected Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| Hard isolation (separate DBs) | Higher cost; complex deployments; no shared features |
| Subdomain-based routing | DNS management; SSL complexity; not all schools have domains |
| Tenant ID in metadata only | Risk of accidental cross-tenant queries; harder to enforce |

## Consequences

- Every table query must include schoolId filter
- All mutations require valid school membership
- Admin users can only see/manage their school data
- Platform super-admin role needed for cross-school operations
- Migration scripts must handle multi-tenant data carefully
