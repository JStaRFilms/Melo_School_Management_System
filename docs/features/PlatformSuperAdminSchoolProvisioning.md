# Platform Super Admin and School Provisioning

## Goal

Enable a platform-level operator (product owner) to provision new schools and assign school admins, establishing the multi-tenant foundation for the School Management System.

## Why This Exists

- `T16` gives a school admin the tools to run a school.
- `SchoolAdminBootstrap` provides a one-time CLI path for the first real school.
- This feature establishes the proper multi-school provisioning flow for ongoing operations.
- Every subsequent school must enter through this flow, not through bootstrap.

## Position In The Timeline

This feature is a **later implementation slice**. It comes after the current school's academic setup work (T16) and verification (T10) are complete. The current one-school delivery path stays intact.

---

## Platform Super Admin

### Role Definition

The platform super admin is the system owner or product owner who manages the multi-school platform. This role is **distinct from school admin**.

| Attribute | Platform Super Admin | School Admin |
|-----------|---------------------|--------------|
| Scope | All schools | One school |
| Data Access | Cross-school aggregated | School-scoped only |
| Primary Job | Provision schools, assign admins | Run school operations |
| Auth Level | Platform-level identity | School-level membership |
| UI Surface | Dedicated platform dashboard | Admin app |

### Responsibilities

**Included:**
- Create new school tenants
- Assign school admins to schools
- View school status and health indicators
- Suspend or reactivate schools (future)
- Access cross-school platform metrics (future)

**Explicitly Out Of Scope:**
- Managing individual school data (classes, students, teachers)
- Entering grades or assessments
- Configuring academic calendars
- Handling billing or payments
- Teacher or student management

### Data Model Impact

The platform super admin is not stored in the school-scoped `users` table.

Decision:
- keep the existing `users` roles school-scoped:
  - `"student" | "parent" | "teacher" | "admin"`
- add a dedicated `platformAdmins` table for platform-level operators

Recommended `platformAdmins` shape:

```typescript
platformAdmins: {
  authId: string
  email: string
  name: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}
```

Why this is the chosen direction:
- keeps tenant-scoped `users` rows clean
- avoids null or sentinel `schoolId` exceptions
- makes platform authorization a separate code path from school authorization
- reduces the chance of accidental cross-school access through reused school-admin helpers

---

## Create School Flow

### Trigger

Platform super admin initiates school creation from the platform dashboard.

### Required Information

| Field | Required | Notes |
|-------|----------|-------|
| School Name | Yes | Display name for the school |
| School Slug | Yes | Unique URL-safe identifier; auto-generated from name with manual override |
| Logo | Optional | Uploadable; same storage pattern as existing school branding |

### Minimum Tenant Bootstrap

When a new school is created, the system must provision:

1. **School Record** — Insert into `schools` table with name, slug, and timestamps.
2. **Branding Defaults** — Initialize with platform default branding (customizable later by school admin).
3. **Empty Academic Structure** — No sessions, terms, classes, or subjects yet. School admin creates these.
4. **No Users Yet** — The school has zero users until a school admin is assigned (next flow).

### Data Flow

```
1. Platform super admin fills school creation form
2. System validates slug uniqueness
3. System creates schools record
4. System initializes default branding config
5. System returns success with new school ID
6. Platform super admin proceeds to assign school admin
```

### Constraints

- School slug must be unique across all schools
- Slug is immutable after creation (URLs depend on it)
- School starts in a "pending" state until a school admin is assigned

---

## Assign School Admin Flow

### Trigger

Platform super admin assigns an admin to a newly created (or existing) school.

### Required Information

| Field | Required | Notes |
|-------|----------|-------|
| School | Yes | Selected from school list |
| Admin Name | Yes | Full name |
| Admin Email | Yes | Login email; must be unique across Better Auth |
| Temporary Password | Yes | Auto-generated or manually set |

### Provisioning Steps

1. **Better Auth Account** — Create a new user in Better Auth with email/password.
2. **School Membership** — Insert a `users` row with:
   - `schoolId` = target school
   - `authId` = Better Auth user ID
   - `role` = `"admin"`
   - `name`, `email` from the form
3. **Confirmation** — Return success with the admin's login email.

### Post-Assignment State

After assignment:
- The school admin can sign in immediately
- They land in the admin app scoped to their school
- They can begin academic setup using the T16 flow
- The school transitions from "pending" to "active"

### Constraints

- A school must have at least one admin to become active
- An admin can only be assigned to one school at a time (for v1)
- If the email already exists in Better Auth, the flow fails with a clear error (no silent merges)

---

## Boundaries: Platform Admin vs School Admin

### Platform Admin Cannot

| Action | Why |
|--------|-----|
| View student records | Data belongs to school |
| Enter grades | Academic operation, not platform operation |
| Manage teachers | School admin responsibility |
| Configure billing | School-level concern |
| Access the admin app | Platform has its own surface |
| Modify school academic structure | School admin ownership |

### School Admin Cannot

| Action | Why |
|--------|-----|
| Create other schools | Platform-level operation |
| Assign admins to other schools | Platform-level operation |
| View other schools' data | Tenant isolation |
| Suspend their own school | Platform-level decision |
| Delete the school | Platform-level decision |

### Shared Concerns

| Concern | Platform Admin | School Admin |
|---------|---------------|--------------|
| School branding | Can set defaults | Can customize |
| School slug | Sets at creation | Cannot change |
| School status | Can suspend/reactivate | Read-only |

---

## UI Surface: Platform Dashboard

### Conceptual Layout

A dedicated platform dashboard (separate from the admin app) for the super admin:

```
/dashboard
  /schools
    - List all schools with status, admin name, creation date
    - Create school button
    - Assign admin action per school
  /school/[id]
    - School details
    - Assigned admin info
    - Health indicators (future)
```

### Implementation Note

Decision:
- implement this as a new monorepo surface at `apps/platform`

Why this is the chosen direction:
- preserves a clean separation between platform operations and school operations
- prevents the existing school-admin app from accreting platform-only navigation and permissions
- keeps future platform reporting and school provisioning flows isolated from day-to-day academic work

---

## Minimum Viable Scope (v1)

### In Scope

| Feature | Description |
|---------|-------------|
| School CRUD | Create schools with name and slug |
| Admin Assignment | Assign one admin per school via form |
| Platform Dashboard | Minimal school list with status |
| Auth Gate | Only platform super admin can access |
| School Status | Pending (no admin) vs Active (has admin) |

### Explicitly Out Of Scope

| Feature | Reason |
|---------|--------|
| School suspension/reactivation | Later; needs status model |
| Cross-school metrics | Later; needs analytics |
| Bulk school import | Not needed for first schools |
| Custom domains | Future feature (FR-021 territory) |
| Billing configuration | School admin concern |
| School deletion | Destructive; needs safeguards |

---

## Dependencies

### What Must Exist Before Implementation

| Dependency | Status |
|------------|--------|
| `schools` table | ✅ Exists in schema |
| `users` table with schoolId | ✅ Exists in schema |
| Better Auth integration | ✅ Exists |
| `SchoolAdminBootstrap` | ✅ Provides first-school path |
| T16 academic setup flow | ✅ School admin can configure school after provisioning |

### What This Feature Enables

| Feature | Relationship |
|---------|-------------|
| Multi-school operations | Foundation for everything below |
| School-scoped billing | Each school has its own fee structure |
| White-label per school | Each school has independent branding |
| Custom domains (future) | School must exist first |

---

## Security Model

### Platform Super Admin Auth

- Platform super admin uses Better Auth like every other signed-in user
- Platform authorization is resolved through the dedicated `platformAdmins` table
- Platform operations require an explicit platform-admin lookup at the Convex function level, not just frontend routing

### Convex Function Pattern

```typescript
// Platform-level function
mutation({
  args: { name: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    // Must be platform super admin
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error("Unauthorized")
    }

    const platformAdmin = await ctx.db.query("platformAdmins")
      .withIndex("by_auth", q => q.eq("authId", identity.subject))
      .unique()

    if (!platformAdmin || !platformAdmin.isActive) {
      throw new Error("Unauthorized: platform access required")
    }
    
    // Validate slug uniqueness
    const existing = await ctx.db.query("schools")
      .filter(q => q.eq(q.field("slug"), args.slug))
      .first()
    if (existing) throw new Error("Slug already in use")
    
    // Create school
    return await ctx.db.insert("schools", {
      name: args.name,
      slug: args.slug,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }
})
```

### Tenant Isolation

- All existing school-scoped functions remain unchanged
- Platform super admin cannot access school data through school-scoped functions
- Platform functions are a separate code path from school functions

---

## Verification Checklist

Before this feature is marked complete:

- [ ] Platform super admin role exists in the system
- [ ] Platform super admin can create a school with name and slug
- [ ] Slug uniqueness is enforced
- [ ] Platform super admin can assign a school admin to a school
- [ ] Assigned school admin receives a Better Auth account
- [ ] Assigned school admin can sign in and lands in their school's admin app
- [ ] School admin cannot access platform dashboard
- [ ] Platform super admin cannot access school-scoped data
- [ ] School transitions from pending to active upon admin assignment
- [ ] Current one-school delivery path is unaffected

---

## Definition Of Done

- The later platform slice is captured clearly enough to delegate without reopening product questions
- The task keeps the current one-school delivery path intact
- Platform super admin is treated as distinct from school admin
- School admins handle teacher/class/student/result setup inside their own tenant
- The one-backend, multi-tenant direction is preserved
