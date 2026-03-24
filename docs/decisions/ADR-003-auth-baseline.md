# ADR-003: Authentication with Better Auth

**Date:** 2026-03-14  
**Status:** Accepted  
**Deciders:** Architect  

## Context

The system needs secure authentication supporting multiple user roles (student, parent, teacher, admin) across multiple schools. Authentication must integrate with Convex and support session management across multiple apps.

## Decision

Use **Better Auth** as the authentication framework:
- Email/password authentication for all user types
- Integration with Convex via `@auth/convex` adapter
- Session-based auth shared across all app surfaces
- Role stored in session, enforced at API level

### Implementation

```typescript
// Better Auth configuration
import { betterAuth } from "better-auth"
import { convexAdapter } from "@auth/convex-adapter"

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  adapter: convexAdapter(),
})
```

## Rationale

1. **TypeScript First:** Full type safety with Convex integration
2. **Multi-Role Support:** Extendable user model for roles (student, parent, teacher, admin)
3. **Active Development:** Better Auth is actively maintained vs alternatives
4. **Simplicity:** Cleaner API than Auth.js; fewer abstractions
5. **Convex Native:** Official adapter provides seamless backend integration

## Rejected Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| NextAuth.js (Auth.js) | Complexity; Convex adapter less mature |
| Clerk | Vendor lock-in; pricing; less control |
| Supabase Auth | Tightly coupled to Supabase ecosystem |
| Custom auth | Security risks; maintenance burden |

## Consequences

- All apps must use same auth instance
- User roles determined at login; stored in session
- Convex functions validate roles via `ctx.auth.getUserRole()`
- Password reset flows must be implemented
- Session cookie shared across app subdomains (future consideration)
