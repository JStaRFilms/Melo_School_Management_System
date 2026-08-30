---
type: project
category: Code
client: None
status: active
created: 2026-03-14
tags: [creativeos]
---

# School Management System

admin: admin@demo-academy.school / Admin123!Pass
teacher: teacher@demo-academy.school / Teacher123!Pass

### Default Seed Passwords
- Admin: `Admin123!Pass`
- Teacher: `Teacher123!Pass`
- Parent: `Parent123!Pass`
- Student: `Student123!Pass`
- Temp/Fallback: `StrongTempPass123!`

pnpm --filter @school/teacher dev
pnpm --filter @school/admin dev

pnpm convex:dev
pnpm convex deploy